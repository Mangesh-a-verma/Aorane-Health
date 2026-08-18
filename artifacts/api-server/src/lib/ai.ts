/**
 * AI Provider Abstraction Layer
 *
 * Admin panel (AI Config page) mein provider/model change karo →
 * yahan se automatically naye provider ko call kiya jaayega.
 *
 * Supported providers: nvidia (AI-powered) | google | anthropic | openai | placeholder
 * Cache: 5-minute in-memory (no Redis needed) for config; Redis-backed for
 * the cross-instance circuit-breaker state (see below).
 *
 * (production-hardening pass):
 * - `media` on a message can now be a SINGLE image OR an ARRAY of images —
 *   needed for multi-page medical report scanning (a lab report is rarely
 *   one page). All 4 provider implementations below accept multiple images
 *   in one call. Existing single-image call sites work unchanged.
 * - Added a shared fetchWithRetry() helper (timeout + retry-with-backoff on
 *   429/5xx) for the 3 raw-fetch providers (google/anthropic/openai) — the
 *   nvidia provider already has its own timeout in nvidia.ts. Previously
 *   these 3 had NEITHER a timeout NOR a retry, so a slow/transient provider
 *   hiccup could hang a request indefinitely on Render, or fail a request
 *   (and waste the caller's already-consumed AI quota) on a retryable error.
 *
 * PHASE 2 — Automatic multi-provider fallback + circuit breaker:
 * - Each feature can now optionally have a `fallbackProvider` / `fallbackModel`
 *   / `fallbackApiKey` configured in Admin Panel > AI Config. If the primary
 *   provider fails (rate-limited, down, empty response, or times out),
 *   callAI() automatically retries once against the fallback — the caller
 *   never sees the failure unless BOTH fail. This means a single provider's
 *   free-tier quota running out no longer takes the whole feature down.
 * - A Redis-backed circuit breaker (shared across all server instances,
 *   via lib/redis.ts) tracks recent failures per provider. Once a provider
 *   has failed repeatedly in a short window, subsequent requests skip
 *   straight to the fallback instead of waiting through a full timeout+retry
 *   cycle first — this is a real latency win once a provider is genuinely
 *   down, not just a one-off blip.
 */

import { db, aiConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { callDeepSeek } from "./nvidia";
import { cache } from "./redis";
import { logger } from "./logger";
import { decryptSecret } from "./crypto";

/**
 * Classified AI-provider error — lets callers (routes) distinguish WHY a
 * call failed instead of every failure collapsing into one generic 502.
 * Added because smart-scan failures were previously indistinguishable:
 * a missing API key, a Gemini free-tier rate limit (429), and a
 * safety-filtered empty response all produced the exact same generic
 * "AI Provider failed to analyze the image" message — impossible to
 * diagnose from the mobile app or even from server logs at a glance.
 */
export class AIProviderError extends Error {
  public readonly code: "missing_key" | "rate_limited" | "provider_error" | "empty_response";
  constructor(code: AIProviderError["code"], message: string) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
  }
}

/** Turn a non-ok fetch Response into a classified AIProviderError. */
async function throwForBadResponse(res: Response, providerLabel: string): Promise<never> {
  if (res.status === 429) {
    throw new AIProviderError(
      "rate_limited",
      `${providerLabel} rate limit hit — likely the free-tier per-minute/per-day quota is exhausted (this quota is shared across ALL AI features in the app, not just this one). Wait a minute and try again, or move to a paid API tier for higher limits.`,
    );
  }
  const bodyText = await res.text().catch(() => "");
  throw new AIProviderError("provider_error", `${providerLabel} error ${res.status}: ${bodyText}`);
}

export interface AIMedia {
  mimeType: string;
  data: string; // Base64
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Single image (legacy) or multiple images (e.g. multi-page document scan) */
  media?: AIMedia | AIMedia[];
}

/** Normalize media to an array regardless of how the caller passed it in. */
function mediaArray(m?: AIMedia | AIMedia[]): AIMedia[] {
  if (!m) return [];
  return Array.isArray(m) ? m : [m];
}

// Tuned down from 45s/3-attempts after Phase 2 added cross-provider
// fallback: retrying the SAME provider up to 3 times before even trying
// the fallback made worst-case total latency (primary retries + fallback
// retries) exceed the mobile app's own request timeout, causing the
// client to abort before the server could finish (observed in production:
// a 26.7s round trip that the app gave up on). Now the primary fails over
// to the fallback faster, and the fallback gets a fair timeout budget of
// its own within the client's patience window.
// Tightened further after production evidence showed requests being cut
// off at ~30s consistently (client "request aborted" logs) — well BELOW
// our previous 45s client-side timeout, which strongly suggests some
// external ceiling (very possibly Render's own infrastructure) that our
// app-level timeout can't override. Since we can't lengthen our way out
// of an external ceiling, the only real fix is to make our own worst-case
// processing time comfortably fit inside it. Retries-within-a-provider
// are now ZERO — with Phase 2's cross-provider fallback in place,
// retrying the SAME (possibly-struggling) provider before trying a
// DIFFERENT one is pure wasted time that eats into an already-tight
// budget for no benefit.
// CORRECTED after production evidence: 13s was too aggressive. Logs showed
// Gemini/NVIDIA legitimately taking 12-20s to fully process an image and
// generate the JSON response — our own 13s timeout was firing and killing
// calls that would very likely have succeeded a few seconds later, not
// because a provider was stuck, but because photo analysis genuinely
// takes that long. (This also means the earlier ~30s "external ceiling"
// theory was likely a red herring — this log shows clean, unambiguous
// 13s self-inflicted timeouts with no client involvement at all, so the
// real constraint was always our own settings, not some Render platform
// limit.) Since the mobile app now waits up to 45s for these specific
// endpoints, there's real room: 20s per provider comfortably covers
// observed legitimate completion times (12-14s) with margin, and
// 20s+20s=40s worst case still leaves ~5s under the client's 45s timeout.
// CORRECTED after production evidence: three separate real requests all
// got cut off by the CLIENT at almost exactly 30.0-30.5 seconds — despite
// the mobile app's own JS timeout being set to 45s for these endpoints.
// This points to a hard ceiling OUTSIDE our control (most likely the
// native Android/OkHttp networking layer under React Native's fetch,
// which can have its own default socket timeout independent of an
// AbortController). Both provider attempts (primary + fallback) need to
// fit inside ~30s TOTAL: 14s x 2 = 28s, ~2s margin.
const DEFAULT_TIMEOUT_MS = 14_000;
const MAX_RETRIES = 0; // rely on cross-provider fallback, not same-provider retries

/**
 * fetch() with a hard timeout (AbortController) and retry-with-backoff on
 * transient failures (429 rate-limit, 502/503/504 upstream hiccups, and
 * network-level aborts/timeouts). Non-retryable errors (4xx other than 429)
 * fail immediately — no point retrying an invalid request or bad API key.
 */
async function fetchWithRetry(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) return res;

      // Retryable HTTP statuses
      if ((res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) && attempt < MAX_RETRIES) {
        const retryAfterHeader = res.headers.get("retry-after");
        const backoffMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, Math.min(backoffMs, 4000)));
        continue;
      }
      return res; // Non-retryable error status — let the caller handle/throw
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      // Network error or abort (timeout) — retry with backoff
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AI provider request failed after retries");
}

interface CachedConfig {
  provider: string;
  model: string;
  apiKey: string | null;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  fallbackApiKey: string | null;
  isEnabled: boolean;
  expiresAt: number;
}

const CONFIG_CACHE = new Map<string, CachedConfig>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getConfig(feature: string): Promise<CachedConfig> {
  const now = Date.now();
  const cached = CONFIG_CACHE.get(feature);
  if (cached && now < cached.expiresAt) return cached;

  const [row] = await db
    .select()
    .from(aiConfigTable)
    .where(eq(aiConfigTable.feature, feature))
    .limit(1);

  const config: CachedConfig = row
    ? {
        provider: row.provider ?? "nvidia",
        model: row.model ?? "meta/llama-3.3-70b-instruct",
        apiKey: safeDecrypt(row.apiKey, feature, "apiKey"),
        fallbackProvider: row.fallbackProvider ?? null,
        fallbackModel: row.fallbackModel ?? null,
        fallbackApiKey: safeDecrypt(row.fallbackApiKey, feature, "fallbackApiKey"),
        isEnabled: row.isEnabled ?? true,
        expiresAt: now + CACHE_TTL_MS,
      }
    : {
        provider: "nvidia",
        model: "meta/llama-3.3-70b-instruct",
        apiKey: null,
        fallbackProvider: null,
        fallbackModel: null,
        fallbackApiKey: null,
        isEnabled: true,
        expiresAt: now + CACHE_TTL_MS,
      };

  CONFIG_CACHE.set(feature, config);
  return config;
}

/** Decrypts a stored key, treating decryption failure as "no key configured"
 * (rather than crashing the whole request) — the caller then falls back to
 * the provider's global env-var key, which is the same behavior as if no
 * per-feature override had been set at all. */
function safeDecrypt(value: string | null, feature: string, field: string): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch (err) {
    logger.error({ err, feature, field }, "[ai] failed to decrypt stored API key, falling back to global key");
    return null;
  }
}

function getGlobalKey(provider: string): string | null {
  const keys: Record<string, string | undefined> = {
    nvidia: process.env.NVIDIA_API_KEY,
    // Prefer real Google Gemini API key for raw v1beta REST calls (proxy uses SDK format)
    google: process.env.GOOGLE_GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };
  return keys[provider] ?? null;
}

function getGeminiBaseUrl(): string {
  // Always use real Google API for raw REST calls (Replit proxy requires SDK format)
  return "https://generativelanguage.googleapis.com";
}

async function callNvidiaProvider(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  maxTokens: number,
  temp: number,
  timeoutMs?: number,
): Promise<string> {
  const openaiMessages = messages.map(m => {
    const imgs = mediaArray(m.media);
    if (imgs.length > 0) {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          ...imgs.map((img) => ({
            type: "image_url",
            image_url: { url: `data:${img.mimeType};base64,${img.data}` },
          })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  return callDeepSeek(openaiMessages as any, apiKey, maxTokens, temp, model, timeoutMs);
}

async function callGoogleProvider(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  maxTokens: number,
  temp: number,
  timeoutMs?: number,
): Promise<string> {
  const systemMsg = messages.find((m: any) => m.role === "system");
  const chatMsgs = messages
    .filter((m: any) => m.role !== "system")
    .map((m: any) => {
      const parts: any[] = [{ text: m.content }];
      for (const img of mediaArray(m.media)) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts,
      };
    });

  const body: Record<string, unknown> = {
    contents: chatMsgs,
    generationConfig: { maxOutputTokens: maxTokens, temperature: temp },
  };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await fetchWithRetry(
    `${getGeminiBaseUrl()}/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    timeoutMs,
  );
  if (!res.ok) await throwForBadResponse(res, "Google Gemini");

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    // Response was cut off mid-generation before it finished — this
    // previously returned the truncated (often invalid/incomplete-JSON)
    // text as if the call had SUCCEEDED, so callAI() never saw it as a
    // failure and the Phase 2 fallback never got a chance to run. Now
    // it's a real error, so a genuinely-too-small maxTokens (or a more
    // verbose model than expected) correctly triggers the fallback
    // provider instead of surfacing a confusing "couldn't parse" error
    // to the end user with no automatic recovery attempted.
    throw new AIProviderError(
      "provider_error",
      `Gemini response was truncated (hit the ${maxTokens}-token limit before finishing). Increase maxTokens for this call, or a shorter/tighter prompt is needed.`,
    );
  }
  if (!text.trim()) {
    // No usable text back — usually Gemini's safety filter blocked the
    // image/prompt (promptFeedback.blockReason) or the response was cut
    // off before any content (finishReason). Either way this is NOT the
    // same failure as a network/quota error, so it gets its own code.
    const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || "unknown";
    throw new AIProviderError("empty_response", `Gemini returned no readable content (reason: ${reason}). The image may be unclear, or content was filtered.`);
  }
  if (text.includes("{") && text.includes("}")) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return jsonMatch[0];
  }
  return text;
}

async function callAnthropicProvider(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  maxTokens: number,
  timeoutMs?: number,
): Promise<string> {
  const systemMsg = messages.find((m: any) => m.role === "system");
  const chatMsgs = messages
    .filter((m: any) => m.role !== "system")
    .map((m: any) => {
      const imgs = mediaArray(m.media);
      if (imgs.length > 0) {
        return {
          role: m.role,
          content: [
            ...imgs.map((img: AIMedia) => ({
              type: "image",
              source: { type: "base64", media_type: img.mimeType, data: img.data },
            })),
            { type: "text", text: m.content },
          ]
        };
      }
      return { role: m.role, content: m.content };
    });

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: chatMsgs,
  };
  if (systemMsg) body.system = systemMsg.content;

  const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, timeoutMs);
  if (!res.ok) await throwForBadResponse(res, "Anthropic");

  const data = await res.json() as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text ?? "";
  if (text.includes("{") && text.includes("}")) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return jsonMatch[0];
  }
  return text;
}

async function callOpenAIProvider(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  maxTokens: number,
  temp: number,
  timeoutMs?: number,
): Promise<string> {
  const openaiMessages = messages.map(m => {
    const imgs = mediaArray(m.media);
    if (imgs.length > 0) {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          ...imgs.map((img) => ({
            type: "image_url",
            image_url: { url: `data:${img.mimeType};base64,${img.data}` },
          })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const res = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages: openaiMessages, max_tokens: maxTokens, temperature: temp }),
  }, timeoutMs);
  if (!res.ok) await throwForBadResponse(res, "OpenAI");

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (text.includes("{") && text.includes("}")) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return jsonMatch[0];
  }
  return text;
}

/** Dispatches to the right provider implementation. Shared by both the
 * primary attempt and the fallback attempt in callAI(). timeoutMs is
 * optional — omit it to use each provider's own default. */
async function callProvider(
  provider: string,
  model: string,
  apiKey: string,
  messages: AIMessage[],
  maxTokens: number,
  temp: number,
  timeoutMs?: number,
): Promise<string> {
  switch (provider) {
    case "nvidia":
      return callNvidiaProvider(messages, model, apiKey, maxTokens, temp, timeoutMs);
    case "google":
      return callGoogleProvider(messages, model, apiKey, maxTokens, temp, timeoutMs);
    case "anthropic":
      return callAnthropicProvider(messages, model, apiKey, maxTokens, timeoutMs);
    case "openai":
      return callOpenAIProvider(messages, model, apiKey, maxTokens, temp, timeoutMs);
    default:
      return callNvidiaProvider(messages, model, apiKey, maxTokens, temp, timeoutMs);
  }
}

// ─── Circuit breaker (Redis-backed — shared across every server instance) ──
// If a provider fails FAILURE_THRESHOLD times within FAILURE_WINDOW_SECONDS,
// it's marked "open" for COOLDOWN_SECONDS: further requests skip straight to
// the fallback instead of waiting through a full timeout+retry cycle first.
// This does NOT block the provider outright — once COOLDOWN_SECONDS passes
// the breaker key simply expires and the provider gets tried again normally
// (a "half-open" retry, in circuit-breaker terminology).
const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_SECONDS = 60;
const COOLDOWN_SECONDS = 30;

async function isCircuitOpen(provider: string): Promise<boolean> {
  try {
    return (await cache.get(`cb:open:${provider}`)) !== null;
  } catch (err) {
    // Redis hiccup — fail OPEN (treat circuit as closed, i.e. attempt the
    // provider normally) rather than blocking AI calls on a cache outage.
    logger.warn({ err, provider }, "[ai] circuit-breaker read failed, assuming closed");
    return false;
  }
}

async function recordProviderFailure(provider: string): Promise<void> {
  try {
    const count = await cache.incrementRateLimitFixed(`cb:fail:${provider}`, FAILURE_WINDOW_SECONDS);
    if (count >= FAILURE_THRESHOLD) {
      await cache.set(`cb:open:${provider}`, "1", COOLDOWN_SECONDS);
      await cache.resetRateLimit(`cb:fail:${provider}`);
      logger.warn({ provider, count }, "[ai] circuit breaker OPEN — skipping this provider for " + COOLDOWN_SECONDS + "s");
    }
  } catch (err) {
    logger.warn({ err, provider }, "[ai] circuit-breaker write failed (non-fatal)");
  }
}

async function recordProviderSuccess(provider: string): Promise<void> {
  try {
    await cache.resetRateLimit(`cb:fail:${provider}`);
  } catch {
    // Non-fatal — worst case the failure streak takes a bit longer to clear.
  }
}

/**
 * Main function — call any AI feature
 *
 * @param feature  Feature key matching ai_config.feature (e.g. 'food_ai', 'health_suggestions')
 * @param messages Array of messages (system/user/assistant)
 * @param options  Optional: maxTokens, temperature
 */
export async function callAI(
  feature: string,
  messages: AIMessage[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const maxTokens = options?.maxTokens ?? 2000;
  const temp = options?.temperature ?? 0.4;

  const config = await getConfig(feature);

  if (!config.isEnabled) {
    throw new Error(`AI feature "${feature}" is disabled in Admin Panel > AI Config`);
  }

  if (config.provider === "placeholder") {
    return JSON.stringify({
      placeholder: true,
      message: `AI provider is set to "placeholder" for feature "${feature}". Configure a real provider in Admin Panel > AI Config.`,
    });
  }

  const resolvedKey = config.apiKey || getGlobalKey(config.provider);
  if (!resolvedKey) {
    throw new AIProviderError(
      "missing_key",
      `No API key for provider "${config.provider}" (feature: "${feature}"). Set GOOGLE_GEMINI_API_KEY as an env var on the server, or set a key in Admin Panel > AI Config.`,
    );
  }

  const hasFallback = Boolean(config.fallbackProvider);

  // No fallback configured — single-provider call, but still give it the
  // full ~28s budget (not the tighter 14s meant for a hedged race) since
  // there's no backup to hedge against here and no parallelism to manage.
  if (!hasFallback) {
    try {
      const result = await callProvider(config.provider, config.model, resolvedKey, messages, maxTokens, temp, HEDGE_DELAY_MS + FALLBACK_TIMEOUT_MS);
      await recordProviderSuccess(config.provider);
      return result;
    } catch (err) {
      await recordProviderFailure(config.provider);
      throw err;
    }
  }

  const primaryCircuitOpen = await isCircuitOpen(config.provider);

  // Primary already known-bad (recent repeated failures) — skip straight
  // to fallback alone. No point hedging against a provider we already
  // know is struggling.
  if (primaryCircuitOpen) {
    logger.warn({ feature, provider: config.provider }, "[ai] primary provider circuit is open, skipping straight to fallback");
    return callFallbackOnly(feature, config, messages, maxTokens, temp);
  }

  return callWithHedgedFallback(feature, config, resolvedKey, messages, maxTokens, temp);
}

/**
 * Hedged fallback (Phase 2.1): starts the primary immediately; if it
 * hasn't succeeded within HEDGE_DELAY_MS, the fallback is started TOO,
 * running in parallel with the still-in-flight primary — whichever
 * succeeds first wins. Replaces the old "wait for primary to fully fail,
 * THEN start fallback" design, which could not fit two ~14s+ sequential
 * AI calls inside the ~30s ceiling confirmed in production (repeated
 * client-side aborts at ~30.0-30.5s across multiple real scans).
 *
 * HEDGE_DELAY_MS = 13s, not a shorter value like 6-8s: production logs
 * show LEGITIMATE successful Gemini photo analysis normally takes
 * 12-14s, not under 8s. At 13s, hedging mostly only fires on requests
 * genuinely running long, without pre-emptively double-calling on ones
 * about to succeed on their own a second later. Honest tradeoff: the
 * fallback DOES get called more often than "only on outright failures"
 * — but only on the slower half of requests, not on every single scan.
 *
 * PRIMARY_TIMEOUT_MS / FALLBACK_TIMEOUT_MS (not just DEFAULT_TIMEOUT_MS):
 * production evidence showed a single shared 14s timeout for BOTH legs
 * barely gave primary any real extra runway after hedging kicked in at
 * 13s (its own 14s timeout fired just 1 second later) — a scan where
 * both providers were genuinely a bit slow that moment failed outright
 * even though hedging had, in principle, given it a second chance.
 * Since primary running in the background past the hedge point costs
 * nothing extra (the fallback is racing independently), it now gets a
 * much longer runway (27s from its own start). The fallback still gets
 * a fair, full window of its own (15s from ITS start at t=13s, ending at
 * t=28s) — worst case stays at max(27s, 28s) = 28s, still with margin
 * under the confirmed ~30s ceiling.
 */
const HEDGE_DELAY_MS = 13_000;
const PRIMARY_TIMEOUT_MS = 27_000;
const FALLBACK_TIMEOUT_MS = 15_000;

async function callWithHedgedFallback(
  feature: string,
  config: CachedConfig,
  primaryKey: string,
  messages: AIMessage[],
  maxTokens: number,
  temp: number,
): Promise<string> {
  const primaryProvider = config.provider;
  const primaryPromise = callProvider(primaryProvider, config.model, primaryKey, messages, maxTokens, temp, PRIMARY_TIMEOUT_MS);
  // Track primary settlement without throwing here — bookkeeping (circuit
  // breaker) happens once, exactly when the promise actually settles,
  // regardless of whether it "wins" a race below.
  const primarySettled = primaryPromise
    .then((value) => { void recordProviderSuccess(primaryProvider); return { ok: true as const, value }; })
    .catch((err) => { void recordProviderFailure(primaryProvider); return { ok: false as const, err }; });

  const hedgeTimeout = new Promise<{ ok: false; timedOut: true }>((resolve) =>
    setTimeout(() => resolve({ ok: false, timedOut: true }), HEDGE_DELAY_MS),
  );

  const firstOutcome = await Promise.race([
    primarySettled,
    hedgeTimeout,
  ]);

  if (firstOutcome.ok) {
    return firstOutcome.value;
  }

  // Either primary failed quickly, or it's just running past the hedge
  // delay — in both cases, bring the fallback in now.
  const fallbackProvider = config.fallbackProvider!;
  const fallbackKey = config.fallbackApiKey || getGlobalKey(fallbackProvider);
  const fallbackModel = config.fallbackModel || fallbackProvider;
  const fallbackCircuitOpen = await isCircuitOpen(fallbackProvider);

  if (!fallbackKey || fallbackCircuitOpen) {
    // No usable fallback right now — just wait out the primary alone.
    const settled = "timedOut" in firstOutcome ? await primarySettled : firstOutcome;
    if (settled.ok) return settled.value;
    throw settled.err;
  }

  logger.info(
    { feature, provider: primaryProvider, fallbackProvider },
    "timedOut" in firstOutcome
      ? `[ai] primary still running after ${HEDGE_DELAY_MS}ms, hedging with fallback in parallel`
      : "[ai] primary failed quickly, starting fallback",
  );

  const fallbackPromise = callProvider(fallbackProvider, fallbackModel, fallbackKey, messages, maxTokens, temp, FALLBACK_TIMEOUT_MS);
  const fallbackSettled = fallbackPromise
    .then((value) => { void recordProviderSuccess(fallbackProvider); return { ok: true as const, value }; })
    .catch((err) => { void recordProviderFailure(fallbackProvider); return { ok: false as const, err }; });

  // If primary already failed (not just a hedge-timeout), only the
  // fallback is still in flight — wait on that alone. Otherwise (genuine
  // hedge-timeout case) both are running — take whichever succeeds.
  const alreadyFailedPrimary = !("timedOut" in firstOutcome);
  const second = alreadyFailedPrimary
    ? await fallbackSettled
    : await firstSuccessOrLastFailure([primarySettled, fallbackSettled]);

  if (second.ok) return second.value;

  // Both failed — surface both errors explicitly so this is diagnosable
  // from a single log line instead of just seeing whichever failed last.
  const primaryResult = alreadyFailedPrimary ? firstOutcome : await primarySettled;
  const primaryMsg = !primaryResult.ok && "err" in primaryResult
    ? (primaryResult.err instanceof Error ? primaryResult.err.message : String(primaryResult.err))
    : "unknown";
  const fallbackMsg = !second.ok ? (second.err instanceof Error ? second.err.message : String(second.err)) : "unknown";
  logger.error({ feature, primaryProvider, fallbackProvider, primaryMsg, fallbackMsg }, "[ai] both primary and fallback failed (hedged race)");
  throw new AIProviderError(
    "provider_error",
    `Both providers failed for feature "${feature}". Primary (${primaryProvider}): ${primaryMsg} | Fallback (${fallbackProvider}): ${fallbackMsg}`,
  );
}

/** Resolves with the FIRST settlement that succeeds — as soon as any one
 * of them does, without waiting for the others (true race-for-success).
 * Only waits for all of them if every single one fails, in which case it
 * resolves with the last failure to arrive. */
async function firstSuccessOrLastFailure<T>(
  settlements: Promise<{ ok: true; value: T } | { ok: false; err: unknown }>[],
): Promise<{ ok: true; value: T } | { ok: false; err: unknown }> {
  return new Promise((resolve) => {
    let remaining = settlements.length;
    let lastFailure: { ok: false; err: unknown } = { ok: false, err: new Error("no settlements provided") };
    for (const settlement of settlements) {
      settlement.then((result) => {
        if (result.ok) {
          resolve(result);
        } else {
          lastFailure = result;
          remaining -= 1;
          if (remaining === 0) resolve(lastFailure);
        }
      });
    }
  });
}

/** Fallback-only path (primary circuit already known-open) — no hedging
 * needed since there's nothing to race against. */
async function callFallbackOnly(
  feature: string,
  config: CachedConfig,
  messages: AIMessage[],
  maxTokens: number,
  temp: number,
): Promise<string> {
  const fallbackProvider = config.fallbackProvider!;
  const fallbackKey = config.fallbackApiKey || getGlobalKey(fallbackProvider);
  if (!fallbackKey) {
    throw new AIProviderError("missing_key", `No API key for fallback provider "${fallbackProvider}" (feature: "${feature}").`);
  }
  const fallbackModel = config.fallbackModel || fallbackProvider;
  if (await isCircuitOpen(fallbackProvider)) {
    throw new AIProviderError("provider_error", `Both primary and fallback providers are currently unavailable for feature "${feature}".`);
  }
  try {
    const result = await callProvider(fallbackProvider, fallbackModel, fallbackKey, messages, maxTokens, temp, HEDGE_DELAY_MS + FALLBACK_TIMEOUT_MS);
    await recordProviderSuccess(fallbackProvider);
    return result;
  } catch (err) {
    await recordProviderFailure(fallbackProvider);
    throw err;
  }
}

/** Call after admin updates ai_config — cache invalidate ho jaayega */
export function invalidateAICache(feature?: string): void {
  if (feature) CONFIG_CACHE.delete(feature);
  else CONFIG_CACHE.clear();
}
