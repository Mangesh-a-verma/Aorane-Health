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
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  let res: Response;
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
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err}`);
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
