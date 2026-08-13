import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "::1" || host.endsWith(".local") ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { url?: string };
    const url = new URL(body.url || "");
    if (!['http:', 'https:'].includes(url.protocol) || isPrivateHost(url.hostname)) {
      return NextResponse.json({ error: "图片地址无效。" }, { status: 400 });
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    const contentType = response.headers.get("content-type")?.split(";")[0] || "";
    if (!response.ok || !contentType.startsWith("image/")) {
      return NextResponse.json({ error: "无法读取图片。" }, { status: 400 });
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "图片不能超过 15 MB。" }, { status: 413 });
    }
    return new NextResponse(bytes, { headers: { "Content-Type": contentType, "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "无法导入网页图片。" }, { status: 400 });
  }
}
