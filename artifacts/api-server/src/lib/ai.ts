/**
 * AI Provider Abstraction Layer
 *
 * Admin panel (AI Config page) mein provider/model change karo →
 * yahan se automatically naye provider ko call kiya jaayega.
 *
 * Supported providers: nvidia (AI-powered) | google | anthropic | openai | placeholder
 * Cache: 5-minute in-memory (no Redis needed)
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
 */

import { db, aiConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { callDeepSeek } from "./nvidia";

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
        isEnabled: row.isEnabled ?? true,
        expiresAt: now + CACHE_TTL_MS,
      }
    : {
        provider: "nvidia",
        model: "meta/llama-3.3-70b-instruct",
        apiKey: null,
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
  if (!res.ok) throw new Error(`Google AI error ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);

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
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);

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
    throw new Error(
      `No API key for provider "${config.provider}". Set it in Admin Panel > AI Config or as environment variable.`,
    );
  }

  switch (config.provider) {
    case "nvidia":
      return callNvidiaProvider(messages, config.model, resolvedKey, maxTokens, temp);
    case "google":
      return callGoogleProvider(messages, config.model, resolvedKey, maxTokens, temp);
    case "anthropic":
      return callAnthropicProvider(messages, config.model, resolvedKey, maxTokens);
    case "openai":
      return callOpenAIProvider(messages, config.model, resolvedKey, maxTokens, temp);
    default:
      return callNvidiaProvider(messages, config.model, resolvedKey, maxTokens, temp);
  }
}

/** Call after admin updates ai_config — cache invalidate ho jaayega */
export function invalidateAICache(feature?: string): void {
  if (feature) CONFIG_CACHE.delete(feature);
  else CONFIG_CACHE.clear();
}
