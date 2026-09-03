import assert from "node:assert/strict";
import test from "node:test";
import { prepareImageUpscaleInput } from "./image-upscale.ts";

test("image upscale preserves one source image and forbids generated dirty textures", () => {
  const source = { name: "reference.png", data: "data:image/png;base64,abc" };

  const prepared = prepareImageUpscaleInput(source);

  assert.deepEqual(prepared.references, [source]);
  assert.match(prepared.prompt, /保持原图的构图、主体、文字、色彩和画面比例不变/);
  assert.match(prepared.prompt, /仅做轻度去模糊、降噪和边缘恢复/);
  assert.match(prepared.prompt, /禁止新增或重构纹理、材质、斑点、颗粒/);
  assert.doesNotMatch(prepared.prompt, /细节补全/);
});
