import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTextEditPrompt,
  hasPendingReplacement,
  normalizeRegion,
  type TextRegion,
} from "./text-edit.ts";

test("normalizeRegion orders negative dimensions and clamps to the image", () => {
  assert.deepEqual(
    normalizeRegion({ x: 0.8, y: -0.2, width: -0.5, height: 1.4 }),
    { x: 0.3, y: 0, width: 0.5, height: 1 },
  );
});

test("hasPendingReplacement only accepts changed non-empty replacement text", () => {
  const base: TextRegion = {
    id: "price",
    text: "299",
    replacement: "199",
    box: { x: 0, y: 0, width: 0.2, height: 0.1 },
    source: "ocr",
  };

  assert.equal(hasPendingReplacement([base]), true);
  assert.equal(hasPendingReplacement([{ ...base, replacement: "299" }]), false);
  assert.equal(hasPendingReplacement([{ ...base, replacement: "  " }]), false);
});

test("buildTextEditPrompt includes replacements and approximate locations", () => {
  const prompt = buildTextEditPrompt([
    {
      id: "price",
      text: "￥299",
      replacement: "￥199",
      box: { x: 0.7, y: 0.1, width: 0.2, height: 0.1 },
      source: "ocr",
    },
    {
      id: "unchanged",
      text: "新品",
      replacement: "新品",
      box: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
      source: "ocr",
    },
  ]);

  assert.match(prompt, /右上区域/);
  assert.match(prompt, /“￥299”替换为“￥199”/);
  assert.doesNotMatch(prompt, /新品/);
  assert.match(prompt, /其他内容保持不变/);
});

test("buildTextEditPrompt supports a manually selected region without recognized text", () => {
  const prompt = buildTextEditPrompt([
    {
      id: "manual",
      text: "",
      replacement: "今日特价",
      box: { x: 0.35, y: 0.4, width: 0.3, height: 0.15 },
      source: "manual",
    },
  ]);

  assert.match(prompt, /中央区域/);
  assert.match(prompt, /替换为“今日特价”/);
});
