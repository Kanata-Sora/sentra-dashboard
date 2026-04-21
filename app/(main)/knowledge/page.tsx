"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Knowledge, Project, KnowledgeCategory } from "@/types/database";
import { cn, CATEGORY_LABELS, CATEGORY_COLORS, formatDate } from "@/lib/utils";
import { Search, Plus, Tag, ChevronDown, ChevronUp, Pencil, Trash2, X, Loader2 } from "lucide-react";

interface KnowledgeWithProject extends Knowledge {
  projects?: { name: string; color: string | null };
}

const CATEGORIES: Array<{ value: KnowledgeCategory | "all"; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "technical", label: "技術" },
  { value: "decision", label: "決定事項" },
  { value: "issue", label: "課題" },
  { value: "other", label: "その他" },
];

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | "all">("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeWithProject | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォーム状態
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<KnowledgeCategory>("other");
  const [formTags, setFormTags] = useState("");
  const [formProjectId, setFormProjectId] = useState("");

  async function fetchData() {
    setLoading(true);
    try {
      const { data: kData } = await supabase
        .from("knowledge")
        .select("*, projects(name, color)")
        .order("created_at", { ascending: false });
      setItems(kData || []);

      const { data: pData } = await supabase
        .from("projects")
        .select("*")
        .order("sort_order");
      setProjects(pData || []);
      if (pData && pData.length > 0) setFormProjectId(pData[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = items.filter((item) => {
    const matchCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchProject = selectedProjectId === "all" || item.project_id === selectedProjectId;
    const matchSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchProject && matchSearch;
  });

  function openNewForm() {
    setEditingItem(null);
    setFormTitle("");
    setFormContent("");
    setFormCategory("other");
    setFormTags("");
    setFormProjectId(projects[0]?.id || "");
    setShowForm(true);
  }

  function openEditForm(item: KnowledgeWithProject) {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormCategory(item.category || "other");
    setFormTags((item.tags || []).join(", "));
    setFormProjectId(item.project_id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!formTitle.trim() || !formContent.trim()) {
      setError("タイトルと内容は必須です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: formTitle,
        content: formContent,
        category: formCategory,
        tags: formTags.split(",").map((t) => t.trim()).filter(Boolean),
        project_id: formProjectId,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("knowledge")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("knowledge").insert(payload);
        if (error) throw error;
      }

      setShowForm(false);
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このナレッジを削除しますか？")) return;
    const { error } = await supabase.from("knowledge").delete().eq("id", id);
    if (!error) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ナレッジベース</h1>
          <p className="text-gray-500 text-sm mt-1">議事録から抽出された知見・決定事項を管理します</p>
        </div>
        <button
          onClick={openNewForm}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規追加
        </button>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          {/* 検索 */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="キーワード検索..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* プロジェクトフィルター */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">全プロジェクト</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* カテゴリフィルター */}
          <div className="flex gap-1">
            {CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedCategory(value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  selectedCategory === value
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 新規・編集フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl border border-primary-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">
              {editingItem ? "ナレッジを編集" : "ナレッジを追加"}
            </h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 text-red-600 text-sm">{error}</div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="タイトル *"
                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as KnowledgeCategory)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="technical">技術</option>
                <option value="decision">決定事項</option>
                <option value="issue">課題</option>
                <option value="other">その他</option>
              </select>
              <select
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="内容 *"
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="タグ (カンマ区切り)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={handleSave}
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

      {/* ナレッジ一覧 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          読み込み中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>ナレッジがありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          CATEGORY_COLORS[item.category || "other"]
                        )}
                      >
                        {CATEGORY_LABELS[item.category || "other"]}
                      </span>
                      {item.projects && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                          style={{ backgroundColor: item.projects.color || "#7C3AED" }}
                        >
                          {item.projects.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{formatDate(item.created_at)}</span>
                    </div>
                    <h3 className="font-medium text-gray-900 mt-1.5">{item.title}</h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditForm(item)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    >
                      {expandedId === item.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {(item.tags || []).length > 0 && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    <Tag className="w-3 h-3 text-gray-300" />
                    {(item.tags || []).map((tag, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {expandedId === item.id && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
