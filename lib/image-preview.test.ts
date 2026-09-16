import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

test("preview is small, cached, preserves source dimensions and leaves original intact", async () => {
  const { imagePreview } = await import("./image-preview.ts");
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-preview-"));
  try {
    await mkdir(path.join(root, "public/generated"), { recursive: true });
    const source = path.join(root, "public/generated/test.png");
    await sharp({ create: { width: 1536, height: 2304, channels: 4, background: "#c95438" } }).png().toFile(source);
    const original = await readFile(source);
    const [first, second] = await Promise.all([imagePreview(root, "test.png"), imagePreview(root, "test.png")]);
    assert.equal(first.width, 1536);
    assert.equal(first.height, 2304);
    const meta = await sharp(first.bytes).metadata();
    assert.equal(meta.format, "webp");
    assert.ok(meta.width! <= 960 && meta.height! <= 960);
    assert.ok(first.bytes.length < original.length);
    assert.deepEqual(first.bytes, second.bytes);
    assert.deepEqual((await imagePreview(root, "test.png")).bytes, first.bytes);
    assert.deepEqual(await readFile(source), original);
    await assert.rejects(imagePreview(root, "../test.png"));
    await assert.rejects(imagePreview(root, "missing.png"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
