import assert from "node:assert/strict";
import test from "node:test";
import { buildImageGenerationPayload } from "./image-generation-payload.ts";

test("Apilio Gemini maps ratio and resolution through its compatible size and quality fields", () => {
  assert.deepEqual(
    buildImageGenerationPayload({
      providerName: "Apilio",
      model: "google/gemini-3.1-flash-image-preview",
      prompt: "生成地铁儿童涂色线稿",
      size: "2048x1376",
      quality: "medium",
      count: 1,
      responseFormat: "url",
    }),
    {
      model: "google/gemini-3.1-flash-image-preview",
      prompt: "生成地铁儿童涂色线稿",
      n: 1,
      response_format: "url",
      size: "3:2",
      quality: "high",
    },
  );
});

test("Apilio Gemini model ids without a vendor prefix use the Gemini payload", () => {
  assert.deepEqual(
    buildImageGenerationPayload({
      providerName: "Apilio",
      model: "gemini-3.1-flash-image",
      prompt: "line art",
      size: "2048x1376",
      quality: "medium",
      count: 1,
      responseFormat: "url",
    }),
    {
      model: "gemini-3.1-flash-image",
      prompt: "line art",
      n: 1,
      response_format: "url",
      size: "3:2",
      quality: "high",
    },
  );
});

test("Apilio Gemini image aliases with resolution suffixes use the Gemini payload", () => {
  for (const model of [
    "gemini-3.1-flash-image-2k",
    "gemini-3.1-flash-image-4k",
    "google/gemini-3-pro-image-preview-4k",
  ]) {
    const payload = buildImageGenerationPayload({
      providerName: "Apilio",
      model,
      prompt: "line art",
      size: "2048x1376",
      quality: "medium",
      count: 1,
      responseFormat: "url",
    });
    assert.equal(payload.size, "3:2", model);
    assert.equal(payload.quality, "high", model);
  }
});

test("non-Gemini image models keep the existing OpenAI-compatible payload", () => {
  assert.deepEqual(
    buildImageGenerationPayload({
      providerName: "Apilio",
      model: "openai/gpt-image-2",
      prompt: "poster",
      size: "2048x2048",
      quality: "high",
      count: 2,
      responseFormat: "url",
    }),
    {
      model: "openai/gpt-image-2",
      prompt: "poster",
      quality: "high",
      n: 2,
      response_format: "url",
      size: "2048x2048",
    },
  );
});

test("Apilio routes GPT Image 2 requests with 4K dimensions through its 4K model alias", () => {
  assert.equal(
    buildImageGenerationPayload({
      providerName: "Apilio",
      model: "gpt-image-2",
      prompt: "product photo",
      size: "3520x2336",
      quality: "high",
      count: 1,
      responseFormat: "url",
    }).model,
    "gpt-image-2-4k",
  );
});
