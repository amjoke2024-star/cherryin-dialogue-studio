import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createZip } from "../../../lib/batch-download";
import { studioPath } from "../../../lib/studio-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const createdAt = request.nextUrl.searchParams.get("createdAt") || "";
  const files = request.nextUrl.searchParams.getAll("file");
  if (!/^\d{10,16}$/.test(createdAt) || !files.length || files.length > 4) {
    return NextResponse.json({ error: "下载参数无效。" }, { status: 400 });
  }
  if (files.some((file) => !/^\/generated\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|webp)$/i.test(file))) {
    return NextResponse.json({ error: "图片路径无效。" }, { status: 400 });
  }

  try {
    const entries = await Promise.all(files.map(async (file, index) => {
      const filename = path.basename(file);
      const extension = path.extname(filename).toLowerCase() || ".png";
      return {
        name: `cherryin-${createdAt}-${index + 1}${extension}`,
        data: new Uint8Array(await readFile(studioPath("public", "generated", filename))),
      };
    }));
    const zip = createZip(entries);
    return new Response(zip.buffer as ArrayBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="cherryin-${createdAt}.zip"`,
        "Content-Length": String(zip.length),
        "Content-Type": "application/zip",
      },
    });
  } catch {
    return NextResponse.json({ error: "批量下载失败，请稍后再试。" }, { status: 500 });
  }
}
