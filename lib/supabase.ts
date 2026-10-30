import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface TeamSession {
  team: { id: string; name: string };
  token: string;
}

// ログイン中の班の情報（画面の読み込みごとに1回だけ取得する）
let sessionPromise: Promise<TeamSession | null> | null = null;

export function getTeamSession(): Promise<TeamSession | null> {
  if (!sessionPromise) {
    sessionPromise = fetch("/api/auth/session").then(async (res) => {
      if (res.ok) return res.json();
      sessionPromise = null;
      // セッション切れならログイン画面へ戻す
      if (res.status === 401) window.location.href = "/login";
      return null;
    });
  }
  return sessionPromise;
}

// Supabaseへの全リクエストに班のトークンを付ける（RLSはこの値で班を判定する）
const teamFetch: typeof fetch = async (input, init) => {
  const session = await getTeamSession();
  const headers = new Headers(init?.headers);
  if (session) headers.set("x-team-token", session.token);
  return fetch(input, { ...init, headers });
};

// クライアントサイド用（ブラウザ）
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: teamFetch },
});

// サーバーサイド用（API Routes / Server Components）
export function createServerSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
