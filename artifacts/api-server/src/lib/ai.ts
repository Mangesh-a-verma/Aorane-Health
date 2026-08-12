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

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 2; // total attempts = 1 + MAX_RETRIES

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
        apiKey: row.apiKey ?? null,
        fallbackProvider: row.fallbackProvider ?? null,
        fallbackModel: row.fallbackModel ?? null,
        fallbackApiKey: row.fallbackApiKey ?? null,
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

  return callDeepSeek(openaiMessages as any, apiKey, maxTokens, temp, model);
}

async function callGoogleProvider(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  maxTokens: number,
  temp: number,
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
  );
  if (!res.ok) await throwForBadResponse(res, "Google Gemini");

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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
  });
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
  });
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
 * primary attempt and the fallback attempt in callAI(). */
async function callProvider(
  provider: string,
  model: string,
  apiKey: string,
  messages: AIMessage[],
  maxTokens: number,
  temp: number,
): Promise<string> {
  switch (provider) {
    case "nvidia":
      return callNvidiaProvider(messages, model, apiKey, maxTokens, temp);
    case "google":
      return callGoogleProvider(messages, model, apiKey, maxTokens, temp);
    case "anthropic":
      return callAnthropicProvider(messages, model, apiKey, maxTokens);
    case "openai":
      return callOpenAIProvider(messages, model, apiKey, maxTokens, temp);
    default:
      return callNvidiaProvider(messages, model, apiKey, maxTokens, temp);
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
  // Only skip straight to fallback if a fallback actually exists — with no
  // fallback configured there's nothing to gain from pre-emptively refusing,
  // so always attempt the primary provider in that case.
  const primaryCircuitOpen = hasFallback && (await isCircuitOpen(config.provider));

  if (!primaryCircuitOpen) {
    try {
      const result = await callProvider(config.provider, config.model, resolvedKey, messages, maxTokens, temp);
      await recordProviderSuccess(config.provider);
      return result;
    } catch (primaryErr) {
      await recordProviderFailure(config.provider);

      if (!hasFallback) throw primaryErr;

      logger.warn(
        { feature, provider: config.provider, err: primaryErr },
        "[ai] primary provider failed, attempting fallback",
      );
      return callFallback(feature, config, messages, maxTokens, temp, primaryErr);
    }
  }

  logger.warn(
    { feature, provider: config.provider },
    "[ai] primary provider circuit is open, skipping straight to fallback",
  );
  return callFallback(feature, config, messages, maxTokens, temp, null);
}

/** Attempts the configured fallback provider. Throws the ORIGINAL primary
 * error (not the fallback's) if no fallback is usable, so the caller sees
 * the more meaningful failure; throws a combined error if both fail. */
async function callFallback(
  feature: string,
  config: CachedConfig,
  messages: AIMessage[],
  maxTokens: number,
  temp: number,
  primaryErr: unknown,
): Promise<string> {
  const fallbackProvider = config.fallbackProvider;
  if (!fallbackProvider) {
    if (primaryErr) throw primaryErr;
    throw new AIProviderError("provider_error", `Primary provider circuit open for feature "${feature}" and no fallback configured.`);
  }

  const fallbackKey = config.fallbackApiKey || getGlobalKey(fallbackProvider);
  if (!fallbackKey) {
    logger.warn({ feature, fallbackProvider }, "[ai] fallback provider has no API key configured, giving up");
    if (primaryErr) throw primaryErr;
    throw new AIProviderError("missing_key", `No API key for fallback provider "${fallbackProvider}" (feature: "${feature}").`);
  }

  const fallbackModel = config.fallbackModel || fallbackProvider;
  if ((await isCircuitOpen(fallbackProvider))) {
    logger.error({ feature, fallbackProvider }, "[ai] fallback provider's circuit is ALSO open — both providers down");
    if (primaryErr) throw primaryErr;
    throw new AIProviderError("provider_error", `Both primary and fallback providers are currently unavailable for feature "${feature}".`);
  }

  try {
    const result = await callProvider(fallbackProvider, fallbackModel, fallbackKey, messages, maxTokens, temp);
    await recordProviderSuccess(fallbackProvider);
    logger.info({ feature, fallbackProvider }, "[ai] fallback provider succeeded");
    return result;
  } catch (fallbackErr) {
    await recordProviderFailure(fallbackProvider);
    logger.error({ feature, fallbackProvider, err: fallbackErr }, "[ai] fallback provider ALSO failed");
    // Both failed — the fallback's error is usually more actionable (it's
    // the last thing that actually ran), but if we only got here because
    // the circuit was already open (no primaryErr), surface the fallback's
    // real error either way.
    throw primaryErr ?? fallbackErr;
  }
}

/** Call after admin updates ai_config — cache invalidate ho jaayega */
export function invalidateAICache(feature?: string): void {
  if (feature) CONFIG_CACHE.delete(feature);
  else CONFIG_CACHE.clear();
}
