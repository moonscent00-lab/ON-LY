import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url")?.trim() ?? "";
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Only http/https URLs are allowed" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: { Accept: "text/calendar,text/plain,*/*" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch ICS (${res.status})` },
        { status: res.status },
      );
    }
    const text = await res.text();
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ICS";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
