import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { Knowledge } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const { query, knowledge }: { query: string; knowledge: Knowledge[] } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    if (!knowledge || knowledge.length === 0) {
      return NextResponse.json({
        answer: "ナレッジベースにまだ情報が蓄積されていません。議事録をアップロードしてナレッジを追加してください。",
      });
    }

    // ナレッジを読みやすい形式に整形してプロンプトに埋め込む
    const knowledgeText = knowledge
      .map((k, i) => {
        const tags = (k.tags || []).length > 0 ? `タグ: ${k.tags!.join(", ")}` : "";
        return `[${i + 1}] ${k.title}\nカテゴリ: ${k.category || "other"}\n${tags}\n${k.content}`;
      })
      .join("\n\n---\n\n");

    const prompt = `あなたはSENTRAプロジェクト（大学のサイバーセキュリティ活動）の知識ベースアシスタントです。
以下のナレッジベースに蓄積された情報をもとに、ユーザーの質問・依頼に答えてください。

## ナレッジベース（${knowledge.length}件）

${knowledgeText}

## 回答のルール
- ナレッジベースに記載された情報を根拠として回答してください
- ナレッジベースに情報がない場合は「この件についての記録はナレッジベースにありません」と明示してください
- 回答は日本語で、読みやすいように見出しや箇条書きを活用してください
- 情報源として参照したナレッジのタイトルを回答の末尾に「参照：〇〇」として示してください

## 質問・依頼
${query}`;

    const answer = await callLLM(prompt);
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("[/api/knowledge-chat] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "解説の生成に失敗しました" },
      { status: 500 }
    );
  }
}
