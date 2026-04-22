import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function callLLM(prompt: string): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192, // 議事録が長い場合でも途中で切れないよう上限を拡大
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude API");
  }
  // マークダウンコードブロックが含まれる場合は除去
  return block.text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
}
