import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      `${getBaseUrl(request)}/?google_error=${error ?? "no_code"}`
    );
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri =
    process.env.NODE_ENV === "production"
      ? "https://on-ly-six.vercel.app/api/auth/callback"
      : "http://localhost:3000/api/auth/callback";

  try {
    // code → access_token + refresh_token 교환
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      throw new Error(`토큰 교환 실패: ${detail}`);
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const expiresAt = Date.now() + tokens.expires_in * 1000;

    // 쿠키에 저장 (httpOnly → JS에서 못 훔침, secure)
    const response = NextResponse.redirect(`${getBaseUrl(request)}/`);

    response.cookies.set("google_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.expires_in,
      path: "/",
    });

    response.cookies.set("google_token_expires_at", String(expiresAt), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30일
      path: "/",
    });

    if (tokens.refresh_token) {
      response.cookies.set("google_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 180, // 180일
        path: "/",
      });
    }

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.redirect(
      `${getBaseUrl(request)}/?google_error=${encodeURIComponent(message)}`
    );
  }
}

function getBaseUrl(request: NextRequest) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
