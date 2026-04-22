"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Trash2, ScrollText, Calendar, Tag } from "lucide-react";
import { formatDate } from "@/lib/utils";

// 議事録と関連データの型
interface MinuteWithRelations {
  id: string;
  title: string;
  meeting_date: string;
  project_id: string | null;
  analyzed: boolean;
  created_at: string;
  projects: { name: string; color: string | null } | null;
  tasks: { id: string }[];
  knowledge: { id: string }[];
}

export default function MinutesPage() {
  const [minutes, setMinutes] = useState<MinuteWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchMinutes() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("minutes")
        .select("*, projects(name, color), tasks(id), knowledge(id)")
        .order("meeting_date", { ascending: false });

      if (error) throw error;
      setMinutes((data as MinuteWithRelations[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  // 議事録を削除（CASCADEにより関連タスク・ナレッジも自動削除）
  async function handleDelete(minute: MinuteWithRelations) {
    const taskCount = minute.tasks.length;
    const knowledgeCount = minute.knowledge.length;

    const message =
      `「${minute.title}」を削除しますか？\n\n` +
      `この議事録から抽出された以下のデータも同時に削除されます：\n` +
      `・タスク：${taskCount}件\n` +
      `・ナレッジ：${knowledgeCount}件\n\n` +
      `この操作は取り消せません。`;

    if (!confirm(message)) return;

    setDeletingId(minute.id);
    setError(null);
    try {
      const { error } = await supabase.from("minutes").delete().eq("id", minute.id);
      if (error) throw error;
      // 削除後はリストから除去
      setMinutes((prev) => prev.filter((m) => m.id !== minute.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    fetchMinutes();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">議事録一覧</h1>
        <p className="text-gray-500 text-sm mt-1">
          過去にアップロードした議事録を管理します。削除すると関連するタスク・ナレッジも同時に削除されます。
        </p>
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
      ) : minutes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>議事録がまだありません</p>
          <p className="text-sm mt-1">アップロードページから議事録を追加してください</p>
        </div>
      ) : (
        <div className="space-y-3">
          {minutes.map((minute) => (
            <div
              key={minute.id}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* タイトル */}
                  <h3 className="font-semibold text-gray-900 truncate">{minute.title}</h3>

                  {/* メタ情報 */}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {/* 会議日 */}
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      {minute.meeting_date}
                    </span>

                    {/* プロジェクトバッジ */}
                    {minute.projects ? (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                        style={{ backgroundColor: minute.projects.color || "#7C3AED" }}
                      >
                        {minute.projects.name}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                        全体会議
                      </span>
                    )}

                    {/* 登録日 */}
                    <span className="text-xs text-gray-400">
                      登録：{formatDate(minute.created_at)}
                    </span>
                  </div>

                  {/* 抽出データの件数 */}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      <Tag className="w-3 h-3" />
                      タスク {minute.tasks.length}件
                    </span>
                    <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      <Tag className="w-3 h-3" />
                      ナレッジ {minute.knowledge.length}件
                    </span>
                  </div>
                </div>

                {/* 削除ボタン */}
                <button
                  onClick={() => handleDelete(minute)}
                  disabled={deletingId === minute.id}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId === minute.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
