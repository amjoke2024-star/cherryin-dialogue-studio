import assert from "node:assert/strict";
import test from "node:test";
import { fetchGeneratedImage } from "./generated-image-download.ts";

test("a temporary download timeout is retried without resubmitting generation", async () => {
  let calls = 0;
  const response = await fetchGeneratedImage("https://cdn.example/result.png", {
    fetcher: async () => {
      calls += 1;
      if (calls === 1) throw new DOMException("timed out", "TimeoutError");
      return new Response("image", { status: 200, headers: { "content-type": "image/png" } });
    },
    wait: async () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("repeated download timeouts are reported as a completed-image download failure", async () => {
  await assert.rejects(
    fetchGeneratedImage("https://cdn.example/result.png", {
      fetcher: async () => { throw new DOMException("timed out", "TimeoutError"); },
      wait: async () => {},
    }),
    /图片已生成，但下载超时.*请勿直接重新生成/,
  );
});
