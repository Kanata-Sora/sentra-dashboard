"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Project, AnalysisResult, TaskStatus, KnowledgeCategory } from "@/types/database";
import { cn, STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/utils";
import { Upload, FileText, Loader2, CheckCircle, Trash2, Plus, Timer } from "lucide-react";
import { useEffect } from "react";

// 編集可能なタスク型（is_long_term・due_date を追加）
type EditableTask = AnalysisResult["tasks"][number] & {
  _id: string;
  is_long_term: boolean;
  due_date: string | null;
};

type EditableKnowledge = AnalysisResult["knowledge"][number] & { _id: string };

function generateId() {
  return Math.random().toString(36).slice(2);
}

// 日付とプロジェクト名からタイトルを自動生成する関数
function generateTitle(date: string, projectId: string, projects: Project[]): string {
  const project = projects.find((p) => p.id === projectId);
  const projectName = project?.name || "全体会議";
  return `${date} ${projectName}`;
}

export default function UploadPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [meetingDate, setMeetingDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editableTasks, setEditableTasks] = useState<EditableTask[]>([]);
  const [editableKnowledge, setEditableKnowledge] = useState<EditableKnowledge[]>([]);
  const [hasResult, setHasResult] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("projects")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setProjects(data || []));
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawText(ev.target?.result as string);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleAnalyze() {
    if (!rawText.trim()) {
      setError("議事録テキストを入力またはファイルをアップロードしてください");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setHasResult(false);

    const projectName =
      selectedProjectId === "all"
        ? "全体会議"
        : projects.find((p) => p.id === selectedProjectId)?.name || "全体会議";

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText, project_name: projectName }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "解析に失敗しました");
      if (data.parse_error) {
        setError(
          "LLMのレスポンスをJSONとして解析できませんでした。生レスポンス: " + data.raw_response
        );
        return;
      }

      // is_long_term・due_dateを初期値falseとnullで追加
      setEditableTasks(
        (data.tasks || []).map((t: AnalysisResult["tasks"][number]) => ({
          ...t,
          _id: generateId(),
          is_long_term: false,
          due_date: null,
        }))
      );
      setEditableKnowledge(
        (data.knowledge || []).map((k: AnalysisResult["knowledge"][number]) => ({
          ...k,
          _id: generateId(),
        }))
      );
      setHasResult(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析に失敗しました");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    // タイトルを自動生成
    const autoTitle = generateTitle(meetingDate, selectedProjectId, projects);

    try {
      // 議事録を保存
      const { data: minuteData, error: mError } = await supabase
        .from("minutes")
        .insert({
          title: autoTitle,
          meeting_date: meetingDate,
          raw_text: rawText,
          project_id: selectedProjectId === "all" ? null : selectedProjectId,
          analyzed: true,
        })
        .select()
        .single();
      if (mError) throw mError;

      const minuteId = minuteData.id;
      const projectId = selectedProjectId === "all" ? null : selectedProjectId;

      if (!projectId) {
        setError(
          "タスク・ナレッジ保存にはプロジェクトを選択してください（「全体会議」は議事録のみ保存されます）"
        );
        setSaved(true);
        setSaving(false);
        return;
      }

      // タスクを保存（is_long_term・due_dateを含む）
      if (editableTasks.length > 0) {
        const tasksToInsert = editableTasks.map((t) => ({
          project_id: projectId,
          minute_id: minuteId,
          title: t.title,
          description: t.description,
          status: t.status,
          assigned_to: t.assigned_to,
          is_long_term: t.is_long_term,
          due_date: t.due_date || null,
        }));
        const { error: tError } = await supabase.from("tasks").insert(tasksToInsert);
        if (tError) throw tError;
      }

      // ナレッジを保存
      if (editableKnowledge.length > 0) {
        const knowledgeToInsert = editableKnowledge.map((k) => ({
          project_id: projectId,
          minute_id: minuteId,
          title: k.title,
          content: k.content,
          category: k.category,
          tags: k.tags,
        }));
        const { error: kError } = await supabase.from("knowledge").insert(knowledgeToInsert);
        if (kError) throw kError;
      }

      setSaved(true);
      setHasResult(false);
      setEditableTasks([]);
      setEditableKnowledge([]);
      setRawText("");
      setFileName(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">議事録アップロード</h1>
        <p className="text-gray-500 text-sm mt-1">
          議事録をアップロードして、タスクとナレッジを自動抽出します
        </p>
      </div>

      {saved && !hasResult && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>保存しました。ダッシュボードに反映されています。</span>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 入力フォーム */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">議事録情報</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* 会議日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              会議日
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* 対象プロジェクト */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              対象プロジェクト
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">全体会議</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* タイトルプレビュー */}
        <div className="mb-4 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
          <span className="text-gray-400 text-xs mr-2">保存タイトル：</span>
          {generateTitle(meetingDate, selectedProjectId, projects)}
        </div>

        {/* ファイルアップロード */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ファイルアップロード (.txt / .md)
          </label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {fileName ? (
              <div className="flex items-center justify-center gap-2 text-primary-600">
                <FileText className="w-5 h-5" />
                <span className="text-sm font-medium">{fileName}</span>
              </div>
            ) : (
              <div className="text-gray-400">
                <Upload className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">クリックしてファイルを選択</p>
                <p className="text-xs mt-1">.txt または .md ファイル</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* テキスト直接入力 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            またはテキスト直接入力
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="議事録テキストをここに貼り付けてください..."
            rows={8}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing || !rawText.trim()}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors",
            analyzing || !rawText.trim()
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-primary-600 text-white hover:bg-primary-700"
          )}
        >
          {analyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              解析中...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              解析する
            </>
          )}
        </button>
      </div>

      {/* 解析結果プレビュー */}
      {hasResult && (
        <div className="space-y-6">
          {/* タスク */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                抽出されたタスク ({editableTasks.length}件)
              </h2>
              <button
                onClick={() =>
                  setEditableTasks((prev) => [
                    ...prev,
                    {
                      _id: generateId(),
                      title: "",
                      description: "",
                      status: "open",
                      assigned_to: null,
                      is_long_term: false,
                      due_date: null,
                    },
                  ])
                }
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
              >
                <Plus className="w-3.5 h-3.5" />
                追加
              </button>
            </div>

            <div className="space-y-3">
              {editableTasks.map((task) => (
                <div
                  key={task._id}
                  className={cn(
                    "border rounded-lg p-3 space-y-2",
                    task.is_long_term ? "border-orange-200 bg-orange-50" : "border-gray-100"
                  )}
                >
                  {/* 1行目：タイトル・ステータス・長期マーク・削除 */}
                  <div className="flex gap-2 items-center">
                    <input
                      value={task.title}
                      onChange={(e) =>
                        setEditableTasks((prev) =>
                          prev.map((t) =>
                            t._id === task._id ? { ...t, title: e.target.value } : t
                          )
                        )
                      }
                      placeholder="タスク名"
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                    <select
                      value={task.status}
                      onChange={(e) =>
                        setEditableTasks((prev) =>
                          prev.map((t) =>
                            t._id === task._id
                              ? { ...t, status: e.target.value as TaskStatus }
                              : t
                          )
                        )
                      }
                      className={cn(
                        "text-xs px-2 py-1 rounded-full border-0 font-medium focus:outline-none",
                        STATUS_COLORS[task.status]
                      )}
                    >
                      <option value="open">未着手</option>
                      <option value="in_progress">進行中</option>
                      <option value="done">完了</option>
                    </select>

                    {/* 長期タスクトグル */}
                    <button
                      onClick={() =>
                        setEditableTasks((prev) =>
                          prev.map((t) =>
                            t._id === task._id ? { ...t, is_long_term: !t.is_long_term } : t
                          )
                        )
                      }
                      title="長期タスクとしてマーク"
                      className={cn(
                        "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-colors",
                        task.is_long_term
                          ? "bg-orange-100 text-orange-600 border border-orange-300"
                          : "bg-gray-100 text-gray-400 border border-gray-200 hover:bg-orange-50 hover:text-orange-400"
                      )}
                    >
                      <Timer className="w-3 h-3" />
                      長期
                    </button>

                    <button
                      onClick={() =>
                        setEditableTasks((prev) => prev.filter((t) => t._id !== task._id))
                      }
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 2行目：詳細（スクロール可）・担当者 */}
                  <div className="flex gap-2">
                    <textarea
                      value={task.description || ""}
                      onChange={(e) =>
                        setEditableTasks((prev) =>
                          prev.map((t) =>
                            t._id === task._id ? { ...t, description: e.target.value } : t
                          )
                        )
                      }
                      placeholder="詳細 (任意)"
                      rows={2}
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400 resize-none overflow-y-auto max-h-24"
                    />
                    <input
                      value={task.assigned_to || ""}
                      onChange={(e) =>
                        setEditableTasks((prev) =>
                          prev.map((t) =>
                            t._id === task._id
                              ? { ...t, assigned_to: e.target.value || null }
                              : t
                          )
                        )
                      }
                      placeholder="担当者 (任意)"
                      className="w-32 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                  </div>

                  {/* 3行目：期限（カレンダーピッカー） */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 shrink-0">期限：</label>
                    <input
                      type="date"
                      value={task.due_date || ""}
                      onChange={(e) =>
                        setEditableTasks((prev) =>
                          prev.map((t) =>
                            t._id === task._id
                              ? { ...t, due_date: e.target.value || null }
                              : t
                          )
                        )
                      }
                      className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ナレッジ */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                抽出されたナレッジ ({editableKnowledge.length}件)
              </h2>
              <button
                onClick={() =>
                  setEditableKnowledge((prev) => [
                    ...prev,
                    {
                      _id: generateId(),
                      title: "",
                      content: "",
                      category: "other",
                      tags: [],
                    },
                  ])
                }
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
              >
                <Plus className="w-3.5 h-3.5" />
                追加
              </button>
            </div>

            <div className="space-y-3">
              {editableKnowledge.map((k) => (
                <div
                  key={k._id}
                  className="border border-gray-100 rounded-lg p-3 space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      value={k.title}
                      onChange={(e) =>
                        setEditableKnowledge((prev) =>
                          prev.map((item) =>
                            item._id === k._id ? { ...item, title: e.target.value } : item
                          )
                        )
                      }
                      placeholder="タイトル"
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                    <select
                      value={k.category}
                      onChange={(e) =>
                        setEditableKnowledge((prev) =>
                          prev.map((item) =>
                            item._id === k._id
                              ? { ...item, category: e.target.value as KnowledgeCategory }
                              : item
                          )
                        )
                      }
                      className={cn(
                        "text-xs px-2 py-1 rounded-full border-0 font-medium focus:outline-none",
                        CATEGORY_COLORS[k.category]
                      )}
                    >
                      <option value="technical">技術</option>
                      <option value="decision">決定事項</option>
                      <option value="issue">課題</option>
                      <option value="other">その他</option>
                    </select>
                    <button
                      onClick={() =>
                        setEditableKnowledge((prev) =>
                          prev.filter((item) => item._id !== k._id)
                        )
                      }
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    value={k.content}
                    onChange={(e) =>
                      setEditableKnowledge((prev) =>
                        prev.map((item) =>
                          item._id === k._id ? { ...item, content: e.target.value } : item
                        )
                      )
                    }
                    placeholder="内容"
                    rows={2}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                  <input
                    value={(k.tags || []).join(", ")}
                    onChange={(e) =>
                      setEditableKnowledge((prev) =>
                        prev.map((item) =>
                          item._id === k._id
                            ? {
                                ...item,
                                tags: e.target.value
                                  .split(",")
                                  .map((t) => t.trim())
                                  .filter(Boolean),
                              }
                            : item
                        )
                      )
                    }
                    placeholder="タグ (カンマ区切り)"
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-medium transition-colors",
                saving
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-primary-600 text-white hover:bg-primary-700"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  確認して保存
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
