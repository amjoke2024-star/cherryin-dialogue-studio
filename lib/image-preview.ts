import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

type Preview = { bytes: Buffer; width: number; height: number };
const pending = new Map<string, Promise<Preview>>();

export async function imagePreview(root: string, filename: string): Promise<Preview> {
  if (!/^[a-zA-Z0-9-]+\.(png|jpg|jpeg|webp)$/.test(filename)) throw new Error("Invalid image filename");
  const source = path.join(root, "public", "generated", filename);
  const info = await stat(source);
  const directory = path.join(root, "data", "image-previews");
  const cache = path.join(directory, `${filename}-${info.size}-${info.mtimeMs}-v1.json`);
  const existing = pending.get(cache);
  if (existing) return existing;
  const operation = (async () => {
    try {
      const saved = JSON.parse(await readFile(cache, "utf8"));
      if (saved.width > 0 && saved.height > 0 && typeof saved.data === "string") {
        return { bytes: Buffer.from(saved.data, "base64"), width: saved.width, height: saved.height };
      }
    } catch { /* A missing or invalid cache is safe to regenerate. */ }
    const input = sharp(source);
    const metadata = await input.metadata();
    const swap = (metadata.orientation ?? 1) >= 5;
    const width = (swap ? metadata.height : metadata.width)!;
    const height = (swap ? metadata.width : metadata.height)!;
    if (!width || !height) throw new Error("Image has no dimensions");
    const bytes = await input.rotate().resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    await mkdir(directory, { recursive: true });
    const temporary = `${cache}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify({ width, height, data: bytes.toString("base64") }));
    await rename(temporary, cache);
    return { bytes, width, height };
  })();
  pending.set(cache, operation);
  try { return await operation; } finally { pending.delete(cache); }
}
