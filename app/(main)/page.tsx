"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Project, Task, TaskStatus } from "@/types/database";
import { cn, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import { RefreshCw, CheckCircle, Clock, Circle, User, Calendar } from "lucide-react";

interface ProjectWithTasks extends Project {
  tasks: Task[];
}

const statusOrder: TaskStatus[] = ["in_progress", "open", "done"];

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const { data: projectsData, error: pError } = await supabase
        .from("projects")
        .select("*")
        .order("sort_order");
      if (pError) throw pError;

      const { data: tasksData, error: tError } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (tError) throw tError;

      const merged: ProjectWithTasks[] = (projectsData || []).map((p) => ({
        ...p,
        tasks: (tasksData || []).filter((t) => t.project_id === p.id),
      }));
      setProjects(merged);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function updateTaskStatus(taskId: string, currentStatus: TaskStatus) {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      open: "in_progress",
      in_progress: "done",
      done: "open",
    };
    const newStatus = nextStatus[currentStatus];
    setUpdating(taskId);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          tasks: p.tasks.map((t) =>
            t.id === taskId ? { ...t, status: newStatus } : t
          ),
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>読み込み中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        <p className="font-medium">エラーが発生しました</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 text-sm underline hover:no-underline"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">チーム進捗ダッシュボード</h1>
          <p className="text-gray-500 text-sm mt-1">各プロジェクトのタスク状況を確認できます</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          更新
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>プロジェクトデータがありません</p>
          <p className="text-sm mt-1">Supabaseにプロジェクトデータを投入してください</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const done = project.tasks.filter((t) => t.status === "done").length;
            const inProgress = project.tasks.filter((t) => t.status === "in_progress").length;
            const open = project.tasks.filter((t) => t.status === "open").length;
            const total = project.tasks.length;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div key={project.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* プロジェクトヘッダー */}
                <div
                  className="h-2"
                  style={{ backgroundColor: project.color || "#7C3AED" }}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-bold text-gray-900 text-lg">{project.name}</h2>
                      {project.description && (
                        <p className="text-gray-500 text-xs mt-1">{project.description}</p>
                      )}
                    </div>
                    <div
                      className="text-xs font-bold px-2 py-1 rounded-full text-white"
                      style={{ backgroundColor: project.color || "#7C3AED" }}
                    >
                      {progress}%
                    </div>
                  </div>

                  {/* 進捗バー */}
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: project.color || "#7C3AED",
                      }}
                    />
                  </div>

                  {/* ステータス集計 */}
                  <div className="flex gap-3 mb-5 text-xs">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>完了 {done}</span>
                    </div>
                    <div className="flex items-center gap-1 text-blue-600">
                      <Clock className="w-3.5 h-3.5" />
                      <span>進行中 {inProgress}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Circle className="w-3.5 h-3.5" />
                      <span>未着手 {open}</span>
                    </div>
                  </div>

                  {/* タスク一覧 */}
                  <div className="space-y-2">
                    {total === 0 ? (
                      <p className="text-center text-gray-400 text-xs py-4">
                        タスクがありません
                      </p>
                    ) : (
                      [...statusOrder]
                        .flatMap((status) =>
                          project.tasks.filter((t) => t.status === status)
                        )
                        .map((task) => (
                          <div
                            key={task.id}
                            className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-gray-800 font-medium leading-snug flex-1">
                                {task.title}
                              </p>
                              <button
                                onClick={() => updateTaskStatus(task.id, task.status)}
                                disabled={updating === task.id}
                                className={cn(
                                  "shrink-0 text-xs px-2 py-0.5 rounded-full font-medium transition-all",
                                  STATUS_COLORS[task.status],
                                  updating === task.id && "opacity-50 cursor-not-allowed"
                                )}
                                title="クリックでステータス変更"
                              >
                                {updating === task.id ? "..." : STATUS_LABELS[task.status]}
                              </button>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              {task.assigned_to && (
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                  <User className="w-3 h-3" />
                                  {task.assigned_to}
                                </span>
                              )}
                              {task.due_date && (
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                  <Calendar className="w-3 h-3" />
                                  {task.due_date}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                    )}
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
