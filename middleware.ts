import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/authConstants";

// Cookieの有無で未ログインの利用者を振り分ける
// （セッションの正当性は API Route とDBのRLSで検証する）
export function middleware(req: NextRequest) {
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)"],
};
