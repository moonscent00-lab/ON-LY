import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "NEXT_PUBLIC_GOOGLE_CLIENT_ID 환경변수가 필요해요." }, { status: 500 });
  }

  const redirectUri =
    process.env.NODE_ENV === "production"
      ? "https://on-ly-six.vercel.app/api/auth/callback"
      : "http://localhost:3000/api/auth/callback";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",   // refresh_token 받기 위해 필수
    prompt: "consent",        // 매번 consent → refresh_token 항상 발급
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
