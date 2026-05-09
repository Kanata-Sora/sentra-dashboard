"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Project, Member } from "@/types/database";
import { Plus, X, Users, Loader2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectWithMembers extends Project {
  members: Member[];
}

export default function SettingsPage() {
  const [projects, setProjects] = useState<ProjectWithMembers[]>([]);
  const [loading, setLoading] = useState(true);

  // メンバー追加フォームの管理
  const [addingToProjectId, setAddingToProjectId] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // プロジェクトとメンバーを取得
  async function fetchData() {
    setLoading(true);
    try {
      const { data: projectsData } = await supabase
        .from("projects")
        .select("*")
        .order("sort_order");

      const { data: membersData } = await supabase
        .from("members")
        .select("*")
        .order("created_at");

      // プロジェクトにメンバーをマージ
      const merged: ProjectWithMembers[] = (projectsData || []).map((p) => ({
        ...p,
        members: (membersData || []).filter((m) => m.project_id === p.id),
      }));
      setProjects(merged);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // メンバー追加フォームを開く
  function openAddForm(projectId: string) {
    setAddingToProjectId(projectId);
    setNewMemberName("");
    setNewMemberEmail("");
    setError(null);
  }

  // メンバーを追加
  async function handleAddMember(projectId: string) {
    if (!newMemberName.trim()) {
      setError("名前を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from("members").insert({
        name: newMemberName.trim(),
        email: newMemberEmail.trim() || null,
        project_id: projectId,
      });
      if (error) throw error;
      setAddingToProjectId(null);
      setNewMemberName("");
      setNewMemberEmail("");
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  // メンバーを削除
  async function handleDeleteMember(memberId: string) {
    if (!confirm("このメンバーを削除しますか？")) return;
    const { error } = await supabase.from("members").delete().eq("id", memberId);
    if (!error) fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        </div>
        <p className="text-gray-500 text-sm mt-1">チームとメンバーを管理します</p>
      </div>

      <div className="space-y-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* プロジェクトカラーバー */}
            <div className="h-2" style={{ backgroundColor: project.color || "#7C3AED" }} />

            <div className="p-6">
              {/* プロジェクトヘッダー */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">{project.name}</h2>
                  {project.description && (
                    <p className="text-gray-500 text-sm mt-0.5">{project.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>{project.members.length}人</span>
                  </div>
                  <button
                    onClick={() =>
                      addingToProjectId === project.id
                        ? setAddingToProjectId(null)
                        : openAddForm(project.id)
                    }
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    メンバー追加
                  </button>
                </div>
              </div>

              {/* メンバー追加フォーム */}
              {addingToProjectId === project.id && (
                <div className="mb-5 p-4 bg-primary-50 rounded-lg border border-primary-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-primary-800">
                      メンバーを追加
                    </span>
                    <button
                      onClick={() => setAddingToProjectId(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {error && (
                    <p className="text-red-600 text-xs mb-2">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddMember(project.id)}
                      placeholder="名前 *"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddMember(project.id)}
                      placeholder="メールアドレス（任意）"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={() => handleAddMember(project.id)}
                      disabled={saving}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0",
                        saving
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-primary-600 text-white hover:bg-primary-700"
                      )}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "追加"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* メンバー一覧 */}
              {project.members.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  メンバーが登録されていません
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {project.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {member.name}
                        </p>
                        {member.email && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {member.email}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded"
                        title="削除"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
