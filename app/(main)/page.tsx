"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Project, Task, TaskStatus } from "@/types/database";
import { cn, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import {
  RefreshCw,
  CheckCircle,
  Clock,
  Circle,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Loader2,
  Timer,
} from "lucide-react";

interface ProjectWithTasks extends Project {
  tasks: Task[];
}

const statusOrder: TaskStatus[] = ["in_progress", "open", "done"];

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // タスク詳細アコーディオンの開閉管理
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // 各プロジェクトの「完了したタスク」セクションの開閉管理
  const [expandedDoneProjects, setExpandedDoneProjects] = useState<Set<string>>(new Set());

  function toggleDoneSection(projectId: string) {
    setExpandedDoneProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }

  // タスク新規追加フォームの管理
  const [showForm, setShowForm] = useState(false);
  const [formProjectId, setFormProjectId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("open");
  const [formAssignedTo, setFormAssignedTo] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formIsLongTerm, setFormIsLongTerm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

      // フォームのデフォルトプロジェクトを先頭に設定
      if (projectsData && projectsData.length > 0) {
        setFormProjectId(projectsData[0].id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  // タスクのステータスをクリックで順番に変更
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

  // タスク新規追加フォームを開く
  function openForm() {
    setFormTitle("");
    setFormDescription("");
    setFormStatus("open");
    setFormAssignedTo("");
    setFormDueDate("");
    setFormIsLongTerm(false);
    setFormError(null);
    setShowForm(true);
  }

  // タスクを新規追加して保存
  async function handleSaveTask() {
    if (!formTitle.trim()) {
      setFormError("タスク名を入力してください");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { error } = await supabase.from("tasks").insert({
        project_id: formProjectId,
        title: formTitle,
        description: formDescription || null,
        status: formStatus,
        assigned_to: formAssignedTo || null,
        due_date: formDueDate || null,
        is_long_term: formIsLongTerm,
      });
      if (error) throw error;
      setShowForm(false);
      await fetchData(); // 一覧を再取得
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
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
        <div className="flex items-center gap-2">
          <button
            onClick={openForm}
            className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            タスク追加
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </button>
        </div>
      </div>

      {/* タスク新規追加フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl border border-primary-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">タスクを追加</h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <div className="mb-4 text-red-600 text-sm">{formError}</div>
          )}

          <div className="space-y-3">
            {/* プロジェクト選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                プロジェクト <span className="text-red-500">*</span>
              </label>
              <select
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* タスク名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                タスク名 <span className="text-red-500">*</span>
              </label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="タスク名を入力"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* 詳細 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">詳細</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="詳細を入力 (任意)"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* ステータス */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="open">未着手</option>
                  <option value="in_progress">進行中</option>
                  <option value="done">完了</option>
                </select>
              </div>

              {/* 担当者 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                <input
                  value={formAssignedTo}
                  onChange={(e) => setFormAssignedTo(e.target.value)}
                  placeholder="担当者名 (任意)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 期限 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">期限</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 長期タスク */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">長期タスク</label>
                <button
                  onClick={() => setFormIsLongTerm((v) => !v)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors w-full",
                    formIsLongTerm
                      ? "bg-orange-50 border-orange-300 text-orange-600"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                  )}
                >
                  <Timer className="w-4 h-4" />
                  {formIsLongTerm ? "長期タスクとしてマーク中" : "長期タスクとしてマーク"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={handleSaveTask}
              disabled={saving}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium",
                saving
                  ? "bg-gray-200 text-gray-400"
                  : "bg-primary-600 text-white hover:bg-primary-700"
              )}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              保存
            </button>
          </div>
        </div>
      )}

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
                {/* プロジェクトカラーバー */}
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

                  {/* タスク一覧（完了以外） */}
                  {(() => {
                    const activeTasks = ["in_progress", "open"].flatMap((status) =>
                      project.tasks.filter((t) => t.status === status)
                    );
                    const doneTasks = project.tasks.filter((t) => t.status === "done");
                    const isDoneOpen = expandedDoneProjects.has(project.id);

                    // タスクカードの共通レンダラー
                    const renderTask = (task: Task) => (
                      <div
                        key={task.id}
                        className={cn(
                          "border rounded-lg overflow-hidden transition-colors",
                          task.is_long_term
                            ? "border-orange-200 bg-orange-50"
                            : "border-gray-100"
                        )}
                      >
                        <div
                          className="flex items-start justify-between gap-2 p-3 cursor-pointer hover:bg-black/5 transition-colors"
                          onClick={() =>
                            setExpandedTaskId(expandedTaskId === task.id ? null : task.id)
                          }
                        >
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {task.is_long_term && (
                              <span className="shrink-0 flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">
                                <Timer className="w-3 h-3" />
                                長期
                              </span>
                            )}
                            <p className="text-sm text-gray-800 font-medium leading-snug truncate">
                              {task.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTaskStatus(task.id, task.status);
                              }}
                              disabled={updating === task.id}
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium transition-all",
                                STATUS_COLORS[task.status],
                                updating === task.id && "opacity-50 cursor-not-allowed"
                              )}
                              title="クリックでステータス変更"
                            >
                              {updating === task.id ? "..." : STATUS_LABELS[task.status]}
                            </button>
                            {expandedTaskId === task.id ? (
                              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </div>
                        </div>
                        {expandedTaskId === task.id && (
                          <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-1.5">
                            {task.description && (
                              <p className="text-xs text-gray-600 whitespace-pre-wrap">
                                {task.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                              {task.assigned_to && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {task.assigned_to}
                                </span>
                              )}
                              {task.due_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {task.due_date}
                                </span>
                              )}
                              {!task.description && !task.assigned_to && !task.due_date && (
                                <span className="text-gray-300">詳細情報なし</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <div className="space-y-2">
                        {total === 0 ? (
                          <p className="text-center text-gray-400 text-xs py-4">
                            タスクがありません
                          </p>
                        ) : (
                          <>
                            {activeTasks.length === 0 && (
                              <p className="text-center text-gray-300 text-xs py-2">
                                進行中・未着手のタスクはありません
                              </p>
                            )}
                            {activeTasks.map(renderTask)}

                            {/* 完了したタスクセクション */}
                            {doneTasks.length > 0 && (
                              <div className="mt-1">
                                <button
                                  onClick={() => toggleDoneSection(project.id)}
                                  className="flex items-center gap-1.5 w-full text-xs text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
                                >
                                  {isDoneOpen ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                  完了したタスク（{doneTasks.length}件）
                                </button>
                                {isDoneOpen && (
                                  <div className="space-y-2 mt-1">
                                    {doneTasks.map(renderTask)}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
