import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/authConstants";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) await deleteSession(token);

    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  } catch (error) {
    console.error("[/api/auth/logout] Error:", error);
    return NextResponse.json({ error: "ログアウトに失敗しました" }, { status: 500 });
  }
}
