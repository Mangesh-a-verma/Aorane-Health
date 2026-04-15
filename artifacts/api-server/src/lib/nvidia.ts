/**
 * NVIDIA-hosted AI API helper (LLaMA, DeepSeek, Mixtral, etc.)
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
): Promise<string> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
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
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[];
  };

  let content = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty response from NVIDIA");

  content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in NVIDIA response");

  return jsonMatch[0];
}
