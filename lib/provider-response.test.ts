import assert from "node:assert/strict";
import test from "node:test";
import {
  providerRequestId,
  readProviderResponseText,
} from "./provider-response.ts";

test("provider request id is recovered from response headers", () => {
  assert.equal(providerRequestId(new Headers({ "x-request-id": "req-4k-123" })), "req-4k-123");
  assert.equal(providerRequestId(new Headers({ "cf-ray": "ray-456" })), "ray-456");
});

test("a response-body interruption reports the 4K edit stage and request id", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.error(new DOMException("stream aborted", "AbortError"));
    },
  });
  const response = new Response(stream, {
    status: 200,
    headers: { "x-request-id": "req-4k-789" },
  });

  await assert.rejects(
    readProviderResponseText(response, {
      providerName: "Apilio",
      operation: "图片编辑",
      model: "gpt-image-2-4k",
      size: "2480x3312",
      headersElapsedMs: 153000,
    }),
    /Apilio 图片编辑已收到响应头.*读取响应正文中断.*gpt-image-2-4k.*2480x3312.*req-4k-789.*153000ms/,
  );
});
