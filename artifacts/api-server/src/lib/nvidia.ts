/**
 * AI API helper for LLaMA, DeepSeek, Mixtral, etc. (hosted via NVIDIA NIM)
 * Non-streaming JSON output for health intelligence features
 * Now supports configurable model via parameter
 */

export interface NvidiaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callDeepSeek(
  messages: NvidiaMessage[],
  apiKey: string,
  maxTokens = 4096,
  temperature = 0.6,
  model = "meta/llama-3.3-70b-instruct",
  timeoutMs = 20000,
  maxRetries = 0,
): Promise<string> {
  // FIX (production incident): this used to hardcode timeoutMs=55000 and
  // MAX_RETRIES=2 unconditionally — completely disconnected from the
  // DEFAULT_TIMEOUT_MS/MAX_RETRIES tuning in ai.ts. When this is called as
  // the Phase 2 FALLBACK for a user-facing photo scan, that meant the
  // fallback alone could take up to ~165 seconds (55s x 3 attempts) even
  // though the primary was tuned to fail fast at 13s — confirmed in
  // production logs where a scan's fallback attempt took 150+ seconds and
  // the mobile app had long since given up and disconnected by then.
  //
  // Now this defaults to the SAME tightened 13s/0-retries budget as the
  // rest of the AI layer (used via callNvidiaProvider in ai.ts, i.e. the
  // food-scan fallback path). callers that genuinely need a longer,
  // retried budget (e.g. corporate-report.ts, which isn't blocking on a
  // mobile client's short timeout) pass their own timeoutMs/maxRetries
  // explicitly instead of relying on a shared, silently-mismatched default.
  const MAX_RETRIES = maxRetries;
  let res: Response | undefined;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          top_p: 0.95,
          max_tokens: maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) break;
      if ((res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
      break; // non-retryable status — fall through to error handling below
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  if (!res) throw lastErr instanceof Error ? lastErr : new Error("NVIDIA AI request failed after retries");

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA AI API error ${res.status} for model "${model}": ${err.slice(0, 300)}`);
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[];
  };

  let content = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty response from AI provider");

  content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Flexible return: return JSON if formatted as such, else plain text
  if (content.includes("{") && content.includes("}")) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return jsonMatch[0];
  }

  return content;
}
