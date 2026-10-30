import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_MAX_AGE_SEC,
  clearLoginFailures,
  createSession,
  findTeamSlugByPassword,
  hashClientIp,
  isLoginLocked,
  recordLoginFailure,
} from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/authConstants";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const ipHash = hashClientIp(req);

    if (await isLoginLocked(ipHash)) {
      return NextResponse.json(
        { error: "ログイン試行回数が上限に達しました。15分ほど待ってから再度お試しください。" },
        { status: 429 }
      );
    }

    const slug = typeof password === "string" ? findTeamSlugByPassword(password) : null;
    if (!slug) {
      await recordLoginFailure(ipHash);
      return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
    }

    await clearLoginFailures(ipHash);
    const token = await createSession(slug);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SEC,
    });
    return res;
  } catch (error) {
    console.error("[/api/auth/login] Error:", error);
    return NextResponse.json({ error: "ログインに失敗しました" }, { status: 500 });
  }
}
