import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { createServerSupabaseClient } from "@/lib/supabase";
import { SnapshotSummary, SnapshotData } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // 全プロジェクト + タスクを取得
    const { data: projectsData, error: pError } = await supabase
      .from("projects")
      .select("*")
      .order("sort_order");
    if (pError) throw pError;

    const { data: tasksData, error: tError } = await supabase
      .from("tasks")
      .select("*");
    if (tError) throw tError;

    const projectsWithTasks = (projectsData || []).map((p) => ({
      ...p,
      tasks: (tasksData || []).filter((t) => t.project_id === p.id),
    }));

    const snapshotData: SnapshotData = {
      projects: projectsWithTasks.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        tasks: p.tasks,
      })),
    };

    // LLMへ送るプロジェクトデータ（簡略化）
    const projectDataForLLM = projectsWithTasks.map((p) => ({
      name: p.name,
      description: p.description,
      tasks_summary: {
        done: p.tasks.filter((t) => t.status === "done").length,
        in_progress: p.tasks.filter((t) => t.status === "in_progress").length,
        open: p.tasks.filter((t) => t.status === "open").length,
        total: p.tasks.length,
        recent_done: p.tasks
          .filter((t) => t.status === "done")
          .slice(0, 5)
          .map((t) => t.title),
        in_progress_tasks: p.tasks
          .filter((t) => t.status === "in_progress")
          .map((t) => t.title),
      },
    }));

    const prompt = `あなたはプロジェクト成果の展示デザイナーです。
以下の3プロジェクトの現在の状況から、ワークショップ展示用のフルボード形式サマリーを生成してください。

## 設計原則
- これは「説明資料」ではなく「ポスター（展示用掲示板）」です。
- 目的は見る人との対話を発生させること
- 文字は最小限に、一目でわかるビジュアル要素が重要
- ビジョン優先（課題ベースではなく、何を実現しようとしているか）を中心に
- Before（まだできていたこと）→ After（具体化された成果物）の対比を明確に

## 出力形式（JSONのみ）

{
  "main_catch": "メインキャッチコピー（インパクトの強い1文、20文字以内）",
  "sub_title": "サブタイトル（補足説明、30文字以内）",
  "overview": "プロジェクト全体の概要（1〜2文、簡潔に）",
  "projects": [
    {
      "name": "プロジェクト名",
      "vision": "このプロジェクトが実現しようとしていること（1文）",
      "before": "着手前の状態・課題（1文）",
      "after": "現在の成果・到達点（1文）",
      "key_metric": "最もインパクトのある数値や成果（例: 'CTF問題 12問制作済み'）",
      "stats": {
        "done": 完了タスク数,
        "in_progress": 進行中タスク数,
        "open": 未着手タスク数
      }
    }
  ],
  "tech_foundation": ["使用技術キーワードのリスト（3〜5個）"],
  "action_hook": "見る人に促すアクション（例: 'デモを体験できます → ダッシュボードを操作してみてください'）"
}

## ルール
- 文字量を極限まで減らし、キャッチコピーと数値で読めること
- 技術用語は最小限に、初見の人にも2秒で要点を伝えられるようにすること
- 各プロジェクトのbefore/afterの対比を明確にすること

## 現在のプロジェクト状況

${JSON.stringify(projectDataForLLM, null, 2)}`;

    const result = await callLLM(prompt);

    let summary: SnapshotSummary;
    try {
      summary = JSON.parse(result);
    } catch {
      return NextResponse.json(
        { error: "LLMのレスポンスをJSONとして解析できませんでした", raw: result },
        { status: 500 }
      );
    }

    // スナップショットを保存
    const title = `${new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long" })} スナップショット`;
    const { data: savedSnapshot, error: sError } = await supabase
      .from("snapshots")
      .insert({
        title,
        generated_summary: JSON.stringify(summary),
        snapshot_data: snapshotData,
      })
      .select()
      .single();

    if (sError) throw sError;

    return NextResponse.json({ id: savedSnapshot.id, summary });
  } catch (error) {
    console.error("[/api/snapshot] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "スナップショット生成に失敗しました" },
      { status: 500 }
    );
  }
}
