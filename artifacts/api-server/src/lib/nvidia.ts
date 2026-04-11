/**
 * NVIDIA-hosted LLaMA 3.3 70B API helper
 * Non-streaming JSON output for health intelligence features
 * Updated: DeepSeek-R1 reached EOL on 2026-01-26, migrated to meta/llama-3.3-70b-instruct
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
): Promise<string> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta/llama-3.3-70b-instruct",
      messages,
      temperature,
      top_p: 0.95,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA DeepSeek error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[];
  };

  let content = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty response from DeepSeek");

  // Strip <think>...</think> reasoning blocks (DeepSeek-R1 chain-of-thought)
  content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in DeepSeek response");

  return jsonMatch[0];
}
