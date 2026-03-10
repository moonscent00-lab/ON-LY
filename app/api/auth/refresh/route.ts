import { NextRequest, NextResponse } from "next/server";

// GET /api/auth/refresh → 현재 유효한 access_token 반환 (만료 시 자동 갱신)
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("google_access_token")?.value;
  const expiresAt = Number(request.cookies.get("google_token_expires_at")?.value ?? "0");
  const refreshToken = request.cookies.get("google_refresh_token")?.value;

  // 토큰 없음 → 로그인 필요
  if (!accessToken && !refreshToken) {
    return NextResponse.json({ error: "not_connected", needsLogin: true }, { status: 401 });
  }

  // 아직 유효 (만료 5분 전까지는 그냥 사용)
  const fiveMinutes = 5 * 60 * 1000;
  if (accessToken && expiresAt > Date.now() + fiveMinutes) {
    return NextResponse.json({ access_token: accessToken, expiresAt });
  }

  // 만료됐는데 refresh_token도 없음
  if (!refreshToken) {
    return NextResponse.json({ error: "token_expired", needsLogin: true }, { status: 401 });
  }

  // refresh_token으로 새 access_token 발급
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      // refresh_token도 만료된 경우 → 재로그인 필요
      if (tokenRes.status === 400) {
        const response = NextResponse.json({ error: "refresh_failed", needsLogin: true }, { status: 401 });
        response.cookies.delete("google_access_token");
        response.cookies.delete("google_refresh_token");
        response.cookies.delete("google_token_expires_at");
        return response;
      }
      throw new Error(detail);
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
    };

    const newExpiresAt = Date.now() + tokens.expires_in * 1000;

    const response = NextResponse.json({
      access_token: tokens.access_token,
      expiresAt: newExpiresAt,
    });

    // 새 토큰 쿠키 업데이트
    response.cookies.set("google_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.expires_in,
      path: "/",
    });

    response.cookies.set("google_token_expires_at", String(newExpiresAt), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "갱신 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/auth/refresh → 로그아웃 (쿠키 삭제)
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("google_access_token");
  response.cookies.delete("google_refresh_token");
  response.cookies.delete("google_token_expires_at");
  return response;
}
