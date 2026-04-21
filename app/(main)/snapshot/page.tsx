"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Snapshot } from "@/types/database";
import { formatDate } from "@/lib/utils";
import { Camera, Loader2, ExternalLink, Trash2 } from "lucide-react";

export default function SnapshotListPage() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchSnapshots() {
    setLoading(true);
    const { data } = await supabase
      .from("snapshots")
      .select("*")
      .order("created_at", { ascending: false });
    setSnapshots(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchSnapshots();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/snapshot", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");
      router.push(`/snapshot/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このスナップショットを削除しますか？")) return;
    const { error } = await supabase.from("snapshots").delete().eq("id", id);
    if (!error) setSnapshots((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">成果スナップショット</h1>
          <p className="text-gray-500 text-sm mt-1">
            プロジェクト全体の成果をフルボード形式で可視化します
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              新しいスナップショットを生成
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          読み込み中...
        </div>
      ) : snapshots.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>スナップショットがまだありません</p>
          <p className="text-sm mt-1">「新しいスナップショットを生成」を押して作成してください</p>
        </div>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snapshot) => {
            let summary: { main_catch?: string; sub_title?: string } = {};
            try {
              summary = JSON.parse(snapshot.generated_summary);
            } catch {}

            return (
              <div
                key={snapshot.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">{formatDate(snapshot.created_at)}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{snapshot.title}</h3>
                    {summary.main_catch && (
                      <p className="text-primary-600 font-medium text-sm mt-1">{summary.main_catch}</p>
                    )}
                    {summary.sub_title && (
                      <p className="text-gray-500 text-xs mt-0.5">{summary.sub_title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => router.push(`/snapshot/${snapshot.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      表示
                    </button>
                    <button
                      onClick={() => handleDelete(snapshot.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
