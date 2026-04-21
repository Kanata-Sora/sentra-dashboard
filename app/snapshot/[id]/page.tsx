"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Snapshot, SnapshotSummary } from "@/types/database";
import { ArrowLeft, CheckCircle, Clock, Circle, Zap } from "lucide-react";
import Link from "next/link";

const TECH_ICONS: Record<string, string> = {
  "Next.js": "▲",
  TypeScript: "TS",
  Supabase: "SB",
  "Gemini API": "G",
  "Claude API": "CL",
  Python: "Py",
  TailwindCSS: "TW",
  React: "Re",
};

function TechBadge({ tech }: { tech: string }) {
  const icon = TECH_ICONS[tech] || tech.slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-sm">
        {icon}
      </div>
      <span className="text-white/70 text-xs">{tech}</span>
    </div>
  );
}

export default function SnapshotViewPage() {
  const params = useParams();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [summary, setSummary] = useState<SnapshotSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("snapshots")
        .select("*")
        .eq("id", params.id)
        .single();
      if (data) {
        setSnapshot(data);
        try {
          setSummary(JSON.parse(data.generated_summary));
        } catch {}
      }
      setLoading(false);
    }
    fetch();
  }, [params.id]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#1a0533] flex items-center justify-center">
        <div className="text-white/60 text-lg animate-pulse">読み込み中...</div>
      </div>
    );
  }

  if (!snapshot || !summary) {
    return (
      <div className="fixed inset-0 bg-[#1a0533] flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-xl mb-4">スナップショットが見つかりません</p>
          <Link href="/snapshot" className="text-purple-300 underline">
            一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#1a0533] via-[#2d0a5e] to-[#1a0533] flex flex-col overflow-hidden">
      {/* 戻るボタン */}
      <button
        onClick={() => router.push("/snapshot")}
        className="absolute top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 text-xs transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        一覧に戻る
      </button>

      {/* 背景装飾 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 rounded-full bg-indigo-600/20 blur-3xl" />
      </div>

      {/* メインコンテンツ */}
      <div className="relative z-10 flex flex-col h-full px-12 py-10">

        {/* 上段 (25%): ビジョンエリア */}
        <div className="flex-[25] flex flex-col justify-center mb-6">
          <div className="max-w-4xl">
            <h1 className="text-6xl font-black text-white leading-tight tracking-tight mb-3">
              {summary.main_catch}
            </h1>
            <p className="text-2xl text-purple-300 font-medium mb-3">{summary.sub_title}</p>
            <p className="text-white/60 text-base max-w-2xl">{summary.overview}</p>
          </div>
        </div>

        {/* 中段 (50%): 成果エリア */}
        <div className="flex-[50] grid grid-cols-3 gap-5 mb-6">
          {(summary.projects || []).map((project, i) => {
            const total = project.stats.done + project.stats.in_progress + project.stats.open;
            const progress = total > 0 ? Math.round((project.stats.done / total) * 100) : 0;
            const colors = ["#EF4444", "#3B82F6", "#7C3AED"];
            const color = colors[i] || "#7C3AED";

            return (
              <div
                key={project.name}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm flex flex-col"
              >
                {/* プロジェクト名 */}
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <h3 className="text-white font-bold text-lg">{project.name}</h3>
                </div>

                {/* ビジョン */}
                <p className="text-white/80 text-sm font-medium mb-4 leading-relaxed">
                  {project.vision}
                </p>

                {/* Before → After */}
                <div className="grid grid-cols-2 gap-2 mb-4 flex-1">
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-white/40 text-xs mb-1">Before</div>
                    <p className="text-white/70 text-xs leading-relaxed">{project.before}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ backgroundColor: `${color}22` }}>
                    <div className="text-xs mb-1" style={{ color: `${color}cc` }}>After</div>
                    <p className="text-white/90 text-xs leading-relaxed font-medium">{project.after}</p>
                  </div>
                </div>

                {/* Key Metric */}
                <div
                  className="text-center py-2 px-3 rounded-xl mb-3 font-bold text-sm"
                  style={{ backgroundColor: `${color}33`, color }}
                >
                  {project.key_metric}
                </div>

                {/* 進捗バー */}
                <div className="mt-auto">
                  <div className="flex justify-between text-xs text-white/50 mb-1">
                    <span>完了率</span>
                    <span className="text-white font-semibold">{progress}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${progress}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      {project.stats.done}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-400" />
                      {project.stats.in_progress}
                    </span>
                    <span className="flex items-center gap-1">
                      <Circle className="w-3 h-3 text-gray-400" />
                      {project.stats.open}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 下段 (25%): 技術基盤 + アクション */}
        <div className="flex-[25] flex items-center gap-8">
          {/* 技術スタック */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-white/60 text-sm font-medium">技術スタック</span>
            </div>
            <div className="flex gap-4 flex-wrap">
              {(summary.tech_foundation || []).map((tech) => (
                <TechBadge key={tech} tech={tech} />
              ))}
            </div>
          </div>

          {/* アクションフック */}
          <div className="shrink-0">
            <div
              className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl px-8 py-5 text-center shadow-2xl shadow-purple-900/50"
            >
              <p className="text-white font-bold text-base leading-relaxed max-w-xs">
                {summary.action_hook}
              </p>
            </div>
          </div>

          {/* 生成日時 */}
          <div className="shrink-0 text-right">
            <p className="text-white/30 text-xs">{snapshot.title}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
