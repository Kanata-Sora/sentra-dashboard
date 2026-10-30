import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/authConstants";
import { createServerSupabaseClient } from "@/lib/supabase";

// セッションの有効期間（7日）
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;
// ログイン失敗の制限（15分間に10回失敗したら一時的に拒否）
const MAX_FAILED_ATTEMPTS = 10;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

// teams.slug とパスワードの環境変数の対応
const TEAM_PASSWORD_ENVS: Record<string, string> = {
  "kochi-police": "TEAM_PASSWORD_KOCHI_POLICE",
  kikagaku: "TEAM_PASSWORD_KIKAGAKU",
};

export interface SessionTeam {
  id: string;
  name: string;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function hashToken(token: string): string {
  return sha256(token).toString("hex");
}

// 接続元IPのハッシュ（生のIPアドレスはDBに保存しない）
export function hashClientIp(req: NextRequest): string {
  const ip =
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";
  return hashToken(ip);
}

// パスワードに一致する班の slug を返す（比較時間で内容を推測されないようにする）
export function findTeamSlugByPassword(password: string): string | null {
  if (!password) return null;
  const input = sha256(password);
  let matched: string | null = null;
  for (const [slug, envName] of Object.entries(TEAM_PASSWORD_ENVS)) {
    const expected = process.env[envName];
    if (expected && timingSafeEqual(input, sha256(expected))) {
      matched = slug;
    }
  }
  return matched;
}

export async function isLoginLocked(ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - LOCK_WINDOW_MS).toISOString();
  const { count, error } = await createServerSupabaseClient()
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("attempted_at", since);
  if (error) throw error;
  return (count ?? 0) >= MAX_FAILED_ATTEMPTS;
}

export async function recordLoginFailure(ipHash: string): Promise<void> {
  const { error } = await createServerSupabaseClient()
    .from("login_attempts")
    .insert({ ip_hash: ipHash });
  if (error) throw error;
}

export async function clearLoginFailures(ipHash: string): Promise<void> {
  const { error } = await createServerSupabaseClient()
    .from("login_attempts")
    .delete()
    .eq("ip_hash", ipHash);
  if (error) throw error;
}

// セッションを発行し、トークン本体を返す（DBにはハッシュのみ保存）
export async function createSession(slug: string): Promise<string> {
  const db = createServerSupabaseClient();
  const { data: team, error: teamError } = await db
    .from("teams")
    .select("id")
    .eq("slug", slug)
    .single();
  if (teamError) throw teamError;

  // 期限切れのセッションはログインのついでに掃除する
  await db.from("team_sessions").delete().lte("expires_at", new Date().toISOString());

  const token = randomBytes(32).toString("base64url");
  const { error } = await db.from("team_sessions").insert({
    token_hash: hashToken(token),
    team_id: team.id,
    expires_at: new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000).toISOString(),
  });
  if (error) throw error;
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  const { error } = await createServerSupabaseClient()
    .from("team_sessions")
    .delete()
    .eq("token_hash", hashToken(token));
  if (error) throw error;
}

// Cookieのセッションを検証し、ログイン中の班を返す
export async function getTeamFromRequest(req: NextRequest): Promise<SessionTeam | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await createServerSupabaseClient()
    .from("team_sessions")
    .select("teams(id, name)")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return (data?.teams as unknown as SessionTeam | null) ?? null;
}

export function unauthorized() {
  return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
}
