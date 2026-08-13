import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { studioPath } from "../../../lib/studio-paths";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await context.params;
    if (!/^[a-zA-Z0-9-]+\.(png|jpg|jpeg|webp)$/.test(filename)) return new NextResponse("Not found", { status: 404 });
    const bytes = await readFile(studioPath("public", "generated", filename));
    const extension = path.extname(filename).toLowerCase();
    const contentType = extension === ".webp" ? "image/webp" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png";
    return new NextResponse(bytes, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
