"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Project, Task, TaskStatus, Member } from "@/types/database";
import { cn, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import {
  RefreshCw,
  Clock,
  Circle,
  CheckCircle,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Loader2,
  Timer,
  Pencil,
  Library,
} from "lucide-react";

interface ProjectWithTasks extends Project {
  tasks: Task[];
}

// 完了から何分後にナレッジへ転送されるかを計算（残留時間：1分）
const DONE_RETENTION_MS = 1 * 60 * 1000; // 1分

function getRemainingMinutes(completedAt: string | null): number {
  if (!completedAt) return 0;
  const expiresAt = new Date(completedAt).getTime() + DONE_RETENTION_MS;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (1000 * 60)));
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // タスク詳細アコーディオンの開閉管理
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

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

  // タスク編集フォームの管理
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("open");
  const [editOriginalStatus, setEditOriginalStatus] = useState<TaskStatus>("open"); // 編集前の元ステータス
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editIsLongTerm, setEditIsLongTerm] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const { data: projectsData, error: pError } = await supabase
        .from("projects")
        .select("*")
        .order("sort_order");
      if (pError) throw pError;

      // 全タスクを取得（完了後24h以内のタスクも含む）
      const { data: tasksData, error: tError } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (tError) throw tError;

      const { data: membersData, error: mError } = await supabase
        .from("members")
        .select("*")
        .order("name");
      if (mError) throw mError;

      // 全タスクを表示（期限切れ完了タスクは migrateDoneTasks で削除済み）
      const merged: ProjectWithTasks[] = (projectsData || []).map((p) => ({
        ...p,
        tasks: (tasksData || []).filter((t) => t.project_id === p.id),
      }));
      setProjects(merged);
      setMembers(membersData || []);

      if (projectsData && projectsData.length > 0) {
        setFormProjectId(projectsData[0].id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  // 完了タスクをナレッジベースに転送してDBから削除
  async function transferTaskToKnowledge(task: Task) {
    const { error: kError } = await supabase.from("knowledge").insert({
      project_id: task.project_id,
      minute_id: task.minute_id,
      title: task.title,
      content: task.description || `「${task.title}」が完了しました。`,
      tags: [],
    });
    if (kError) throw kError;

    const { error: dError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id);
    if (dError) throw dError;

    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        tasks: p.tasks.filter((t) => t.id !== task.id),
      }))
    );
  }

  // 現在ダッシュボードに残留している完了タスクをすべて即時転送（一回限りの移行用）
  async function migrateAllDoneTasks() {
    const { data: allDoneTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "done");

    if (!allDoneTasks || allDoneTasks.length === 0) return;

    const knowledgeToInsert = allDoneTasks.map((task: Task) => ({
      project_id: task.project_id,
      minute_id: task.minute_id,
      title: task.title,
      content: task.description || `「${task.title}」が完了しました。`,
      tags: [],
    }));

    await supabase.from("knowledge").insert(knowledgeToInsert);
    await supabase
      .from("tasks")
      .delete()
      .in("id", allDoneTasks.map((t: Task) => t.id));
  }

  // 残留時間（1分）を超えた完了タスクをナレッジに一括転送（ページ読み込み時に実行）
  async function migrateDoneTasks() {
    const thresholdTime = new Date(Date.now() - DONE_RETENTION_MS).toISOString();

    // completed_at が null（旧データ）または1分超過のタスクを対象
    const { data: expiredTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "done")
      .or(`completed_at.is.null,completed_at.lte.${thresholdTime}`);

    if (!expiredTasks || expiredTasks.length === 0) return;

    const knowledgeToInsert = expiredTasks.map((task: Task) => ({
      project_id: task.project_id,
      minute_id: task.minute_id,
      title: task.title,
      content: task.description || `「${task.title}」が完了しました。`,
      tags: [],
    }));

    await supabase.from("knowledge").insert(knowledgeToInsert);
    await supabase
      .from("tasks")
      .delete()
      .in("id", expiredTasks.map((t: Task) => t.id));
  }

  // ステータスバッジクリックでサイクル変更
  async function updateTaskStatus(task: Task) {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      open: "in_progress",
      in_progress: "done",
      done: "open", // 完了 → 未着手に戻す
    };
    const newStatus = nextStatus[task.status];
    setUpdating(task.id);
    try {
      const updatePayload: Partial<Task> & { updated_at: string } = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "done") {
        // 完了にしたとき: completed_at を記録（24h後にナレッジへ）
        updatePayload.completed_at = new Date().toISOString();
      } else if (task.status === "done") {
        // 完了から戻すとき: completed_at をクリア
        updatePayload.completed_at = null;
      }

      const { error } = await supabase
        .from("tasks")
        .update(updatePayload)
        .eq("id", task.id);
      if (error) throw error;

      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          tasks: p.tasks.map((t) =>
            t.id === task.id ? { ...t, ...updatePayload } : t
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
        // 新規追加で完了ステータスを選んだ場合も completed_at を記録
        completed_at: formStatus === "done" ? new Date().toISOString() : null,
      });
      if (error) throw error;
      setShowForm(false);
      await fetchData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  // 編集フォームを開く
  function openEditTask(task: Task) {
    setEditingTaskId(task.id);
    setEditProjectId(task.project_id);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditStatus(task.status);
    setEditOriginalStatus(task.status); // 編集前ステータスを保存
    setEditAssignedTo(task.assigned_to || "");
    setEditDueDate(task.due_date || "");
    setEditIsLongTerm(task.is_long_term);
    setEditError(null);
    setExpandedTaskId(task.id);
  }

  // タスクを更新して保存
  async function handleUpdateTask() {
    if (!editTitle.trim()) {
      setEditError("タスク名を入力してください");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      // completed_at の更新ロジック
      let completedAt: string | null | undefined = undefined; // undefined = 変更しない
      if (editStatus === "done" && editOriginalStatus !== "done") {
        // 完了に変更した → completed_at を記録
        completedAt = new Date().toISOString();
      } else if (editStatus !== "done" && editOriginalStatus === "done") {
        // 完了から別ステータスに戻した → completed_at をクリア
        completedAt = null;
      }

      const updatePayload: Record<string, unknown> = {
        title: editTitle,
        description: editDescription || null,
        status: editStatus,
        assigned_to: editAssignedTo || null,
        due_date: editDueDate || null,
        is_long_term: editIsLongTerm,
        updated_at: new Date().toISOString(),
      };
      if (completedAt !== undefined) {
        updatePayload.completed_at = completedAt;
      }

      const { error } = await supabase
        .from("tasks")
        .update(updatePayload)
        .eq("id", editingTaskId!);
      if (error) throw error;
      setEditingTaskId(null);
      setExpandedTaskId(null);
      await fetchData();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setEditSaving(false);
    }
  }

  useEffect(() => {
    async function init() {
      // 現在残留中の完了タスクをすべて即時転送（初回のみ）
      await migrateAllDoneTasks();
      // 以降は1分超過のタスクを転送
      await migrateDoneTasks();
      await fetchData();
    }
    init();
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
        <button onClick={fetchData} className="mt-3 text-sm underline hover:no-underline">
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
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
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && <div className="mb-4 text-red-600 text-sm">{formError}</div>}

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
                </select>
              </div>

              {/* 担当者 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                {members.filter((m) => m.project_id === formProjectId).length > 0 ? (
                  <select
                    value={formAssignedTo}
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">担当者なし</option>
                    {members
                      .filter((m) => m.project_id === formProjectId)
                      .map((m) => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                  </select>
                ) : (
                  <input
                    value={formAssignedTo}
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    placeholder="担当者名（設定ページでメンバー登録可）"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                )}
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
                saving ? "bg-gray-200 text-gray-400" : "bg-primary-600 text-white hover:bg-primary-700"
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
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const inProgress = project.tasks.filter((t) => t.status === "in_progress").length;
            const open = project.tasks.filter((t) => t.status === "open").length;
            const done = project.tasks.filter((t) => t.status === "done").length;

            // 完了タスクは末尾に、その他は長期優先→担当者名順
            const sortedTasks = [...project.tasks].sort((a, b) => {
              if (a.status === "done" && b.status !== "done") return 1;
              if (a.status !== "done" && b.status === "done") return -1;
              if (a.is_long_term !== b.is_long_term) return a.is_long_term ? -1 : 1;
              const aName = a.assigned_to ?? "￿";
              const bName = b.assigned_to ?? "￿";
              return aName.localeCompare(bName, "ja");
            });

            return (
              <div key={project.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* プロジェクトカラーバー */}
                <div className="h-2" style={{ backgroundColor: project.color || "#7C3AED" }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-bold text-gray-900 text-lg">{project.name}</h2>
                      {project.description && (
                        <p className="text-gray-500 text-xs mt-1">{project.description}</p>
                      )}
                    </div>
                  </div>

                  {/* ステータス集計 */}
                  <div className="flex gap-3 mb-5 text-xs flex-wrap">
                    <div className="flex items-center gap-1 text-blue-600">
                      <Clock className="w-3.5 h-3.5" />
                      <span>進行中 {inProgress}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Circle className="w-3.5 h-3.5" />
                      <span>未着手 {open}</span>
                    </div>
                    {done > 0 && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>完了 {done}</span>
                      </div>
                    )}
                  </div>

                  {/* タスク一覧 */}
                  <div className="space-y-2">
                    {project.tasks.length === 0 ? (
                      <p className="text-center text-gray-400 text-xs py-4">タスクがありません</p>
                    ) : (
                      sortedTasks.map((task) => {
                        const isDone = task.status === "done";
                        const remainingMinutes = isDone ? getRemainingMinutes(task.completed_at) : null;

                        return (
                          <div
                            key={task.id}
                            className={cn(
                              "border rounded-lg overflow-hidden transition-colors",
                              isDone
                                ? "border-green-200 bg-green-50"
                                : task.is_long_term
                                ? "border-orange-200 bg-orange-50"
                                : "border-gray-100"
                            )}
                          >
                            {/* タスクヘッダー行 */}
                            <div
                              className="flex items-start justify-between gap-2 p-3 cursor-pointer hover:bg-black/5 transition-colors"
                              onClick={() => {
                                if (editingTaskId === task.id) return;
                                setExpandedTaskId(expandedTaskId === task.id ? null : task.id);
                              }}
                            >
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                {task.is_long_term && !isDone && (
                                  <span className="shrink-0 flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">
                                    <Timer className="w-3 h-3" />
                                    長期
                                  </span>
                                )}
                                <p className={cn(
                                  "text-sm font-medium leading-snug truncate",
                                  isDone ? "text-gray-500 line-through" : "text-gray-800"
                                )}>
                                  {task.title}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* 完了後のカウントダウンバッジ */}
                                {isDone && remainingMinutes !== null && (
                                  <span
                                    className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 font-medium"
                                    title="この時間後にナレッジベースへ自動転送されます"
                                  >
                                    <Library className="w-3 h-3" />
                                    {remainingMinutes > 0 ? `あと${remainingMinutes}分` : "まもなく転送"}
                                  </span>
                                )}
                                {/* ステータスバッジ（クリックで変更） */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateTaskStatus(task);
                                  }}
                                  disabled={updating === task.id}
                                  className={cn(
                                    "text-xs px-2 py-0.5 rounded-full font-medium transition-all",
                                    STATUS_COLORS[task.status],
                                    updating === task.id && "opacity-50 cursor-not-allowed"
                                  )}
                                  title={isDone ? "クリックで未着手に戻す" : "クリックでステータス変更"}
                                >
                                  {updating === task.id ? "..." : STATUS_LABELS[task.status]}
                                </button>
                                {/* 編集ボタン */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    editingTaskId === task.id
                                      ? setEditingTaskId(null)
                                      : openEditTask(task);
                                  }}
                                  className="text-gray-300 hover:text-primary-500 transition-colors"
                                  title="編集"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {expandedTaskId === task.id ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                )}
                              </div>
                            </div>

                            {/* 展開エリア：編集フォーム or 詳細表示 */}
                            {expandedTaskId === task.id && (
                              <div className="border-t border-gray-100">
                                {editingTaskId === task.id ? (
                                  /* 編集フォーム */
                                  <div className="px-3 pb-3 pt-3 space-y-2">
                                    {editError && <p className="text-red-500 text-xs">{editError}</p>}
                                    <input
                                      value={editTitle}
                                      onChange={(e) => setEditTitle(e.target.value)}
                                      placeholder="タスク名 *"
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                                    />
                                    <textarea
                                      value={editDescription}
                                      onChange={(e) => setEditDescription(e.target.value)}
                                      placeholder="詳細（任意）"
                                      rows={2}
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">ステータス</label>
                                        <select
                                          value={editStatus}
                                          onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
                                        >
                                          <option value="open">未着手</option>
                                          <option value="in_progress">進行中</option>
                                          <option value="done">完了</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">担当者</label>
                                        {members.filter((m) => m.project_id === editProjectId).length > 0 ? (
                                          <select
                                            value={editAssignedTo}
                                            onChange={(e) => setEditAssignedTo(e.target.value)}
                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
                                          >
                                            <option value="">担当者なし</option>
                                            {members
                                              .filter((m) => m.project_id === editProjectId)
                                              .map((m) => (
                                                <option key={m.id} value={m.name}>{m.name}</option>
                                              ))}
                                          </select>
                                        ) : (
                                          <input
                                            value={editAssignedTo}
                                            onChange={(e) => setEditAssignedTo(e.target.value)}
                                            placeholder="担当者名（任意）"
                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
                                          />
                                        )}
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">期限</label>
                                        <input
                                          type="date"
                                          value={editDueDate}
                                          onChange={(e) => setEditDueDate(e.target.value)}
                                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">長期タスク</label>
                                        <button
                                          onClick={() => setEditIsLongTerm((v) => !v)}
                                          className={cn(
                                            "flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-xs border transition-colors",
                                            editIsLongTerm
                                              ? "bg-orange-50 border-orange-300 text-orange-600"
                                              : "bg-gray-50 border-gray-200 text-gray-400"
                                          )}
                                        >
                                          <Timer className="w-3 h-3" />
                                          {editIsLongTerm ? "長期タスク" : "通常タスク"}
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-1">
                                      <button
                                        onClick={() => { setEditingTaskId(null); setExpandedTaskId(null); }}
                                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                                      >
                                        キャンセル
                                      </button>
                                      <button
                                        onClick={handleUpdateTask}
                                        disabled={editSaving}
                                        className={cn(
                                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                          editSaving
                                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                            : "bg-primary-600 text-white hover:bg-primary-700"
                                        )}
                                      >
                                        {editSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                                        保存
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* 詳細表示 */
                                  <div className="px-3 pb-3 pt-2 space-y-1.5">
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
                                      {isDone && task.completed_at && (
                                        <span className="flex items-center gap-1 text-green-500">
                                          <CheckCircle className="w-3 h-3" />
                                          {new Date(task.completed_at).toLocaleString("ja-JP", {
                                            month: "numeric",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })} に完了
                                        </span>
                                      )}
                                      {!task.description && !task.assigned_to && !task.due_date && !isDone && (
                                        <span className="text-gray-300">詳細情報なし</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
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
