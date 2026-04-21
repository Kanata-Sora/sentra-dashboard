export type TaskStatus = "open" | "in_progress" | "done";
export type KnowledgeCategory = "technical" | "decision" | "issue" | "other";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
}

export interface Member {
  id: string;
  name: string;
  email: string | null;
  project_id: string | null;
  created_at: string;
}

export interface Minute {
  id: string;
  title: string;
  meeting_date: string;
  raw_text: string;
  project_id: string | null;
  analyzed: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  minute_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Knowledge {
  id: string;
  project_id: string;
  minute_id: string | null;
  title: string;
  content: string;
  category: KnowledgeCategory | null;
  tags: string[] | null;
  created_at: string;
}

export interface Snapshot {
  id: string;
  title: string;
  generated_summary: string;
  snapshot_data: SnapshotData;
  created_at: string;
}

// LLMが生成するスナップショットのJSON構造
export interface SnapshotSummary {
  main_catch: string;
  sub_title: string;
  overview: string;
  projects: ProjectSummary[];
  tech_foundation: string[];
  action_hook: string;
}

export interface ProjectSummary {
  name: string;
  vision: string;
  before: string;
  after: string;
  key_metric: string;
  stats: {
    done: number;
    in_progress: number;
    open: number;
  };
}

export interface SnapshotData {
  projects: Array<{
    id: string;
    name: string;
    color: string | null;
    tasks: Task[];
  }>;
}

// LLM解析結果の型
export interface AnalysisResult {
  tasks: Array<{
    title: string;
    description: string;
    status: TaskStatus;
    assigned_to: string | null;
  }>;
  knowledge: Array<{
    title: string;
    content: string;
    category: KnowledgeCategory;
    tags: string[];
  }>;
}

// Supabaseから取得するTaskWithProject
export interface TaskWithProject extends Task {
  projects?: Project;
}

// プロジェクトとタスクをまとめた型
export interface ProjectWithTasks extends Project {
  tasks: Task[];
}
