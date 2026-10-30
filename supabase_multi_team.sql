-- SENTRA Dashboard - 班ごとのデータ分離（マイグレーション）
-- supabase_setup.sql の適用済みDBに対して、Supabaseの「SQL Editor」で1回実行してください。
-- 既存データはすべて「高知県警」に割り当てます。何度実行しても安全です。
-- パスワードは公開リポジトリに残さないよう、ここには書かず環境変数で管理します。

begin;

-- ============================================================
-- 1. 班・ログインセッション・ログイン失敗記録
--    サーバー（service_role）だけが読み書きする
-- ============================================================
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,    -- 環境変数のパスワードと対応付けるキー
  name text not null,           -- 画面に表示する班名
  sort_order int not null,
  created_at timestamptz default now()
);

create table if not exists team_sessions (
  token_hash text primary key,  -- トークン本体は保存せず、SHA-256 のみ保存
  team_id uuid not null references teams(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_ip_time_idx
  on login_attempts (ip_hash, attempted_at);

alter table teams enable row level security;
alter table team_sessions enable row level security;
alter table login_attempts enable row level security;
revoke all on teams, team_sessions, login_attempts from anon, authenticated;

insert into teams (slug, name, sort_order) values
  ('kochi-police', '高知県警', 1),
  ('kikagaku', 'キカガク', 2)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ============================================================
-- 2. リクエストヘッダのトークンから、ログイン中の班を求める
-- ============================================================
create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.team_id
  from public.team_sessions s
  where s.token_hash = encode(
      sha256(convert_to(
        nullif(current_setting('request.headers', true), '')::json ->> 'x-team-token',
        'UTF8'
      )),
      'hex'
    )
    and s.expires_at > now()
$$;

revoke all on function public.current_team_id() from public;
grant execute on function public.current_team_id() to anon, authenticated, service_role;

-- ============================================================
-- 3. 各テーブルに team_id を追加し、既存データを高知県警へ割り当て
-- ============================================================
do $$
declare
  t text;
  police_id uuid;
begin
  select id into police_id from teams where slug = 'kochi-police';

  foreach t in array array['projects', 'members', 'minutes', 'tasks', 'knowledge'] loop
    execute format('alter table %I add column if not exists team_id uuid references teams(id)', t);
    execute format('update %I set team_id = $1 where team_id is null', t) using police_id;
    execute format('alter table %I alter column team_id set not null', t);
    -- 画面側の insert は team_id を指定しないので、ログイン中の班を既定値にする
    execute format('alter table %I alter column team_id set default public.current_team_id()', t);
    execute format('create index if not exists %I on %I (team_id)', t || '_team_id_idx', t);
  end loop;
end $$;

-- メールアドレスの重複チェックは班の中だけで行う
alter table members drop constraint if exists members_email_key;
create unique index if not exists members_team_email_key on members (team_id, email);

-- ============================================================
-- 4. 全公開のRLSポリシーを削除し、自分の班の行だけ操作できるようにする
-- ============================================================
do $$
declare
  p record;
  t text;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('projects', 'members', 'minutes', 'tasks', 'knowledge')
  loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;

  foreach t in array array['projects', 'members', 'minutes', 'tasks', 'knowledge'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy team_isolation on %I for all to anon, authenticated
         using (team_id = public.current_team_id())
         with check (team_id = public.current_team_id())',
      t
    );
  end loop;
end $$;

-- ============================================================
-- 5. キカガクの初期プロジェクト（タスク追加にはプロジェクトが必要）
-- ============================================================
insert into projects (name, description, color, sort_order, team_id)
select 'キカガク', 'キカガクのタスク管理', '#0EA5E9', 1, t.id
from teams t
where t.slug = 'kikagaku'
  and not exists (select 1 from projects p where p.team_id = t.id);

commit;
