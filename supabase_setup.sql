-- SENTRA Dashboard - Supabaseテーブルセットアップ
-- Supabaseダッシュボードの「SQL Editor」で実行してください

-- ============================================================
-- 1. プロジェクト（3つ固定）
-- ============================================================
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text,                   -- ダッシュボード表示色（例: '#7C3AED'）
  sort_order int not null,      -- 表示順
  created_at timestamptz default now()
);

-- ============================================================
-- 2. メンバー
-- ============================================================
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  project_id uuid references projects(id),
  created_at timestamptz default now()
);

-- ============================================================
-- 3. 議事録
-- ============================================================
create table if not exists minutes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date date not null,
  raw_text text not null,
  project_id uuid references projects(id),  -- null = 全体会議
  analyzed boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 4. タスク（議事録から抽出）
-- ============================================================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) not null,
  minute_id uuid references minutes(id),
  title text not null,
  description text,
  status text not null default 'open',      -- 'open' | 'in_progress' | 'done'
  assigned_to text,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 5. ナレッジベース（議事録から抽出）
-- ============================================================
create table if not exists knowledge (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) not null,
  minute_id uuid references minutes(id),
  title text not null,
  content text not null,
  category text,                             -- 'technical' | 'decision' | 'issue' | 'other'
  tags text[],
  created_at timestamptz default now()
);

-- ============================================================
-- 初期データ：3プロジェクト
-- ============================================================
insert into projects (name, description, color, sort_order) values
  ('CTF開催', 'CTF大会の企画・運営', '#EF4444', 1),
  ('SNS監視システム', 'SNS上の違法投稿検出システムの開発', '#3B82F6', 2),
  ('成果可視化', '本アプリの開発（SENTRA全体の成果可視化）', '#7C3AED', 3)
on conflict do nothing;

-- ============================================================
-- RLS（Row Level Security）設定
-- プロトタイプ段階では全公開にする
-- ============================================================
alter table projects enable row level security;
alter table members enable row level security;
alter table minutes enable row level security;
alter table tasks enable row level security;
alter table knowledge enable row level security;
-- 全テーブルを全ユーザーに公開（プロトタイプ用）
create policy "public_read_projects" on projects for select using (true);
create policy "public_write_projects" on projects for all using (true);

create policy "public_read_members" on members for select using (true);
create policy "public_write_members" on members for all using (true);

create policy "public_read_minutes" on minutes for select using (true);
create policy "public_write_minutes" on minutes for all using (true);

create policy "public_read_tasks" on tasks for select using (true);
create policy "public_write_tasks" on tasks for all using (true);

create policy "public_read_knowledge" on knowledge for select using (true);
create policy "public_write_knowledge" on knowledge for all using (true);

