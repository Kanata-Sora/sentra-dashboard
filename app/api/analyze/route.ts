import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { AnalysisResult } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const { raw_text, project_name } = await req.json();

    if (!raw_text || typeof raw_text !== "string") {
      return NextResponse.json({ error: "raw_text is required" }, { status: 400 });
    }

    const prompt = `あなたはプロジェクト管理アシスタントです。
以下の議事録テキストを分析し、JSON形式で構造化してください。

対象プロジェクト: ${project_name || "不明"}

## 出力形式（JSONのみ、他のテキストは不要）

{
  "tasks": [
    {
      "title": "タスク名",
      "description": "詳細説明",
      "status": "done | in_progress | open",
      "assigned_to": "担当者名（不明なら null）"
    }
  ],
  "knowledge": [
    {
      "title": "知見のタイトル",
      "content": "知見の詳細内容",
      "category": "technical | decision | issue | other",
      "tags": ["タグ1", "タグ2"]
    }
  ]
}

## ルール
- tasksには、完了したこと・進行中のこと・次にすべきことを含める
- knowledgeには、技術的な知見・ツール・手法の選定理由・判断・制約事項・重要な意思決定とその理由を含める
- 議事録から読み取れる情報のみ抽出し、推測で補完しないこと

## 議事録テキスト

${raw_text}`;

    const result = await callLLM(prompt);

    let parsed: AnalysisResult;
    try {
      parsed = JSON.parse(result);
    } catch {
      // JSONパース失敗時はフォールバック
      return NextResponse.json({
        tasks: [],
        knowledge: [],
        raw_response: result,
        parse_error: true,
      });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[/api/analyze] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "解析に失敗しました" },
      { status: 500 }
    );
  }
}
