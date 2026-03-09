import { NextResponse } from "next/server";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

function guessImageMimeFromUrl(url: URL) {
  const path = url.pathname.toLowerCase();
  const match = path.match(/\.([a-z0-9]+)$/);
  if (!match) return null;
  return EXT_TO_MIME[match[1]] ?? null;
}

function isPinterestHost(hostname: string) {
  return hostname === "pinterest.com" || hostname.endsWith(".pinterest.com");
}

function isPinimgHost(hostname: string) {
  return hostname === "pinimg.com" || hostname.endsWith(".pinimg.com");
}

function buildUpstreamHeaders(target: URL) {
  const headers: Record<string, string> = {
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent": "DiaryOS-ImageProxy/1.0",
  };
  if (isPinimgHost(target.hostname) || isPinterestHost(target.hostname)) {
    headers.Referer = "https://www.pinterest.com/";
    headers.Origin = "https://www.pinterest.com";
  } else {
    headers.Referer = target.origin;
  }
  return headers;
}

async function fetchUpstream(url: string, target: URL) {
  return fetch(url, {
    cache: "no-store",
    headers: buildUpstreamHeaders(target),
  });
}

function pickPinterestOgImage(html: string) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const found = html.match(pattern)?.[1];
    if (found) return found.replaceAll("&amp;", "&");
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim() ?? "";
  if (!rawUrl) {
    return new NextResponse("Missing url", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
    return new NextResponse("Unsupported protocol", { status: 400 });
  }

  try {
    const upstream = await fetchUpstream(target.toString(), target);
    if (!upstream.ok) {
      return new NextResponse("Upstream fetch failed", { status: 502 });
    }

    const rawContentType = upstream.headers.get("content-type") ?? "";
    const baseContentType = rawContentType.split(";")[0].trim().toLowerCase();
    const guessedType = guessImageMimeFromUrl(target);
    if (baseContentType.startsWith("text/html") && isPinterestHost(target.hostname)) {
      const html = await upstream.text();
      const ogImage = pickPinterestOgImage(html);
      if (!ogImage) {
        return new NextResponse("Not an image", { status: 415 });
      }
      const ogUrl = new URL(ogImage, target).toString();
      const ogTarget = new URL(ogUrl);
      const imageRes = await fetchUpstream(ogUrl, ogTarget);
      if (!imageRes.ok) {
        return new NextResponse("Upstream fetch failed", { status: 502 });
      }
      const imageContentType = (imageRes.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const imageGuessed = guessImageMimeFromUrl(ogTarget);
      const effectiveImageType =
        imageContentType.startsWith("image/") ? imageContentType : imageGuessed ?? "";
      if (!effectiveImageType) {
        return new NextResponse("Not an image", { status: 415 });
      }
      const imageBody = await imageRes.arrayBuffer();
      return new NextResponse(imageBody, {
        status: 200,
        headers: {
          "Content-Type": effectiveImageType,
          "Cache-Control": "no-store",
        },
      });
    }

    const effectiveContentType =
      baseContentType.startsWith("image/") ? baseContentType : guessedType ?? "";
    if (!effectiveContentType) return new NextResponse("Not an image", { status: 415 });

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": effectiveContentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Proxy error", { status: 500 });
  }
}
