import assert from "node:assert/strict";
import test from "node:test";
import { retainStudioHistory, matchesStudioHistory } from "./studio-history.ts";

test("retains older favorites as well as 120 ordinary records", () => {
  const items = Array.from({ length: 130 }, (_, id) => ({ id, favorite: id === 0 }));
  assert.deepEqual(retainStudioHistory(items).map(({ id }) => id),
    [0, ...Array.from({ length: 120 }, (_, index) => index + 10)]);
});

test("finds history by prompt or model case-insensitively", () => {
  const item = { prompt: "紫色装置艺术", modelId: "gpt-image-2.6-2k" };
  assert.equal(matchesStudioHistory(item, " 2.6-2K "), true);
  assert.equal(matchesStudioHistory(item, "装置"), true);
  assert.equal(matchesStudioHistory(item, "蓝色"), false);
});
