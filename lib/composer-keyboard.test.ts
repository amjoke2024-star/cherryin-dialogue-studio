import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the prompt composer only submits from the send button", async () => {
  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    pageSource,
    /function keyDown\([\s\S]*?void send\(\);[\s\S]*?\n  }/,
  );
  assert.doesNotMatch(pageSource, /<textarea[\s\S]*?onKeyDown=\{keyDown\}/);
  assert.match(
    pageSource,
    /aria-label=\{busy \? "加入生成队列"[\s\S]*?onClick=\{\(\) => void send\(\)\}/,
  );
});
