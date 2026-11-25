import { NextRequest, NextResponse } from "next/server";
import { generateImages, type ImageGenerationInput } from "../../../lib/server-image-generation";

export async function POST(request: NextRequest) {
  try {
    return await generateImages(await request.json() as ImageGenerationInput);
  } catch {
    return NextResponse.json({ error: "无法读取生成参数。" }, { status: 400 });
  }
}
