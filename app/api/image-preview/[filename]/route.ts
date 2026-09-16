import { NextRequest, NextResponse } from "next/server";
import { imagePreview } from "../../../../lib/image-preview";
import { studioPath } from "../../../../lib/studio-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!/^[a-zA-Z0-9-]+\.(png|jpg|jpeg|webp)$/.test(filename)) return new NextResponse("Not found", { status: 404 });
  try {
    const preview = await imagePreview(studioPath(), filename);
    return new NextResponse(new Uint8Array(preview.bytes), { headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(preview.bytes.length),
      "X-Image-Width": String(preview.width),
      "X-Image-Height": String(preview.height),
      "Cache-Control": "public, max-age=31536000, immutable",
    } });
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    return new NextResponse(missing ? "Not found" : "Preview unavailable", { status: missing ? 404 : 500 });
  }
}
