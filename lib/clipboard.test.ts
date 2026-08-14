import assert from "node:assert/strict";
import test from "node:test";
import { copyText } from "./clipboard.ts";

test("copyText copies non-empty OCR text", async () => {
  let copied = "";
  const clipboard = {
    writeText: async (value: string) => {
      copied = value;
    },
  };

  assert.equal(await copyText("原文字", clipboard), true);
  assert.equal(copied, "原文字");
});

test("copyText rejects empty text", async () => {
  let called = false;
  const clipboard = {
    writeText: async () => {
      called = true;
    },
  };

  assert.equal(await copyText("", clipboard), false);
  assert.equal(called, false);
});

test("copyText reports clipboard failures", async () => {
  const clipboard = {
    writeText: async () => {
      throw new Error("denied");
    },
  };

  assert.equal(await copyText("原文字", clipboard), false);
});
