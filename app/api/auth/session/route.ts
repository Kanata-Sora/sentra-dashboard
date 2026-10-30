import { NextRequest, NextResponse } from "next/server";
import { getTeamFromRequest, unauthorized } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/authConstants";

// 応答をキャッシュさせない
export const dynamic = "force-dynamic";

// ログイン中の班名と、Supabaseへのリクエストに付けるトークンを返す
export async function GET(req: NextRequest) {
  try {
    const team = await getTeamFromRequest(req);
    if (!team) return unauthorized();

    return NextResponse.json(
      { team, token: req.cookies.get(SESSION_COOKIE)?.value },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[/api/auth/session] Error:", error);
    return NextResponse.json({ error: "セッションの確認に失敗しました" }, { status: 500 });
  }
}
