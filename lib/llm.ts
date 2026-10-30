// ============================================================
// LLM 呼び出しモジュール（Google Gemini）
// Gemini の OpenAI互換チャットAPI（/chat/completions）を fetch で呼び出す。
// OpenAI互換のエンドポイントであれば、環境変数の差し替えだけで他のLLMにも切り替えられる。
//
// 必要な環境変数（.env.local / Vercel）:
//   LLM_API_KEY   Google AI Studio で発行した Gemini APIキー（必須）
//   LLM_BASE_URL  （任意）未指定なら Gemini のOpenAI互換エンドポイント
//   LLM_MODEL     （任意）未指定なら gemini-flash-latest
// ============================================================

// LLM_BASE_URL 未指定時のデフォルト（Gemini の OpenAI互換エンドポイント）
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
// LLM_MODEL 未指定時のデフォルトモデル
const DEFAULT_MODEL = "gemini-flash-latest";
// 一時的なエラー（503 / 429）のときの最大試行回数
const MAX_ATTEMPTS = 4;

interface CallLLMOptions {
  // true のとき JSON 出力モードを要求する
  json?: boolean;
}

export async function callLLM(
  prompt: string,
  options: CallLLMOptions = {}
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY が設定されていません。.env.local に Gemini のAPIキーを設定してください。"
    );
  }
  const baseUrl = process.env.LLM_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  // max_tokens はあえて指定しない（長い議事録でレスポンスが途中で切れないよう、モデルの上限に任せる）
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2, // 抽出・要約タスク向けに出力のばらつきを抑える
    stream: false,
  };
  // JSON抽出用途では JSON 出力モードを要求して安定性を高める
  if (options.json) {
    body.response_format = { type: "json_object" };
  }

  // baseUrl 末尾のスラッシュを正規化してから /chat/completions を付与
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  // Gemini は混雑時に 503 / 429 を返すことがあるため、間隔を空けて再試行する
  let res: Response;
  for (let attempt = 1; ; attempt++) {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const retryable = res.status === 503 || res.status === 429;
    if (!retryable || attempt >= MAX_ATTEMPTS) break;
    // 2秒 → 4秒 → 8秒 と待ち時間を伸ばす
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `LLMリクエストが失敗しました (HTTP ${res.status})。LLM_API_KEY とモデル名を確認してください。 ${detail.slice(
        0,
        300
      )}`
    );
  }

  const data = await res.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("LLMからの応答形式が不正です");
  }

  // マークダウンコードブロックが含まれる場合は除去
  return content
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
}
