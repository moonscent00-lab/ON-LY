import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "ON-LY Diary/1.0 (contact: moonscent00@gmail.com)",
      },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Geocode upstream failed" }, { status: 502 });
    }
    const rows = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const first = rows[0];
    if (!first?.lat || !first?.lon) {
      return NextResponse.json({ lat: null, lng: null }, { status: 200 });
    }
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ lat: null, lng: null }, { status: 200 });
    }
    return NextResponse.json({ lat, lng }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Geocode proxy error" }, { status: 500 });
  }
}
