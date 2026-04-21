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
