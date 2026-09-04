import assert from "node:assert/strict";
import test from "node:test";
import * as imageUpscale from "./image-upscale.ts";

const { prepareImageUpscaleInput } = imageUpscale;

test("image upscale preserves one source image and forbids generated dirty textures", () => {
  const source = { name: "reference.png", data: "data:image/png;base64,abc" };

  const prepared = prepareImageUpscaleInput(source);

  assert.deepEqual(prepared.references, [source]);
  assert.match(prepared.prompt, /保持原图的构图、主体、文字、色彩和画面比例不变/);
  assert.match(prepared.prompt, /仅做轻度去模糊、降噪和边缘恢复/);
  assert.match(prepared.prompt, /禁止新增或重构纹理、材质、斑点、颗粒/);
  assert.doesNotMatch(prepared.prompt, /细节补全/);
});

test("image upscale defaults to the Apilio Gemini 3.1 Flash 4K model", () => {
  const preferredImageUpscaleModel = Reflect.get(
    imageUpscale,
    "preferredImageUpscaleModel",
  );
  assert.equal(typeof preferredImageUpscaleModel, "function");

  const models = [
    { id: "gpt-image-2", name: "GPT Image 2" },
    {
      id: "gemini-3.1-flash-image-preview-4k",
      name: "Gemini 3.1 Flash Image Preview 4k",
    },
  ];

  assert.equal(
    preferredImageUpscaleModel(models),
    "gemini-3.1-flash-image-preview-4k",
  );
});

test("image upscale still exposes its default model before Apilio models load", () => {
  const imageUpscaleModelOptions = Reflect.get(
    imageUpscale,
    "imageUpscaleModelOptions",
  );
  assert.equal(typeof imageUpscaleModelOptions, "function");

  assert.deepEqual(imageUpscaleModelOptions([]), [
    {
      id: "gemini-3.1-flash-image-preview-4k",
      name: "Gemini 3.1 Flash Image Preview 4k",
      note: "Apilio · 图片放大默认模型",
      mark: "⚡",
    },
  ]);
});
