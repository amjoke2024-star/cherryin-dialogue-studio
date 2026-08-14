import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTextEditPrompt,
  hasPendingReplacement,
  isLikelyTextRegion,
  normalizeRegion,
  persistentTextEditReferences,
  preferredTextEditSource,
  resizeTextRegionBox,
  shouldDismissTextEditWorkspace,
  shouldCollapseTextEditWorkspace,
  textEditGuideRegions,
  type TextRegion,
} from "./text-edit.ts";

test("text edit adopts the first uploaded image without replacing an existing source", () => {
  const first = { name: "第一张.png", data: "first" };
  const second = { name: "第二张.png", data: "second" };
  const existing = { name: "正在改字.png", data: "existing" };

  assert.equal(preferredTextEditSource(null, [first, second]), first);
  assert.equal(preferredTextEditSource(existing, [first, second]), existing);
  assert.equal(preferredTextEditSource(null, []), null);
});

test("resizing a text box moves only the selected corner", () => {
  const box = { x: 0.2, y: 0.3, width: 0.4, height: 0.2 };

  assert.deepEqual(resizeTextRegionBox(box, "north-west", { x: 0.1, y: 0.2 }), {
    x: 0.1, y: 0.2, width: 0.5, height: 0.3,
  });
  assert.deepEqual(resizeTextRegionBox(box, "north-east", { x: 0.8, y: 0.2 }), {
    x: 0.2, y: 0.2, width: 0.6, height: 0.3,
  });
  assert.deepEqual(resizeTextRegionBox(box, "south-west", { x: 0.1, y: 0.7 }), {
    x: 0.1, y: 0.3, width: 0.5, height: 0.4,
  });
  assert.deepEqual(resizeTextRegionBox(box, "south-east", { x: 0.8, y: 0.7 }), {
    x: 0.2, y: 0.3, width: 0.6, height: 0.4,
  });
});

test("resizing stays inside the image and cannot collapse the text box", () => {
  const box = { x: 0.2, y: 0.3, width: 0.4, height: 0.2 };

  assert.deepEqual(resizeTextRegionBox(box, "north-west", { x: -1, y: -1 }), {
    x: 0, y: 0, width: 0.6, height: 0.5,
  });
  assert.deepEqual(resizeTextRegionBox(box, "south-east", { x: 0.1, y: 0.1 }), {
    x: 0.2, y: 0.3, width: 0.01, height: 0.01,
  });
});

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

test("only a new text edit submission collapses the workspace", () => {
  assert.equal(shouldCollapseTextEditWorkspace(true, false), true);
  assert.equal(shouldCollapseTextEditWorkspace(true, true), false);
  assert.equal(shouldCollapseTextEditWorkspace(false, false), false);
});

test("text edit guide numbers only changed regions in stable order", () => {
  const regions: TextRegion[] = [
    { id: "keep", text: "不变", replacement: "不变", box: { x: 0, y: 0, width: 0.1, height: 0.1 }, source: "ocr" },
    { id: "headline", text: "新品预售", replacement: "我是大侠", box: { x: 0.2, y: 0.2, width: 0.5, height: 0.15 }, source: "ocr" },
    { id: "empty", text: "说明", replacement: " ", box: { x: 0, y: 0.5, width: 0.2, height: 0.1 }, source: "ocr" },
    { id: "manual", text: "", replacement: "今日上新", box: { x: 0.1, y: 0.7, width: 0.3, height: 0.1 }, source: "manual" },
  ];

  assert.deepEqual(textEditGuideRegions(regions).map(({ number, region }) => [number, region.id]), [
    [1, "headline"],
    [2, "manual"],
  ]);

  const prompt = buildTextEditPrompt(regions, { hasGuide: true });
  assert.match(prompt, /第2张图是带编号框的定位图/);
  assert.match(prompt, /标记框 1/);
  assert.match(prompt, /标记框 2/);
  assert.match(prompt, /定位图中的边框、编号和标记颜色不得出现在结果中/);
});

test("temporary location guides are excluded from persisted references", () => {
  const references = [
    { name: "原图.png", data: "original" },
    { name: "文字定位图.png", data: "guide", transient: true },
  ];

  assert.deepEqual(persistentTextEditReferences(references), [references[0]]);
});

test("expanded text edit workspace only dismisses for an outside pointer", () => {
  assert.equal(shouldDismissTextEditWorkspace(true, true, false), true);
  assert.equal(shouldDismissTextEditWorkspace(true, true, true), false);
  assert.equal(shouldDismissTextEditWorkspace(false, true, false), false);
  assert.equal(shouldDismissTextEditWorkspace(true, false, false), false);
});

test("OCR visibility keeps useful text and hides noisy regions", () => {
  const base: TextRegion = {
    id: "ocr",
    text: "新品预售",
    replacement: "",
    confidence: 88,
    box: { x: 0.2, y: 0.1, width: 0.5, height: 0.1 },
    source: "ocr",
  };

  assert.equal(isLikelyTextRegion(base), true);
  assert.equal(isLikelyTextRegion({ ...base, confidence: 30 }), false);
  assert.equal(isLikelyTextRegion({ ...base, text: "///---" }), false);
  assert.equal(isLikelyTextRegion({ ...base, box: { x: 0, y: 0.2, width: 0.9, height: 0.2 } }), false);
  assert.equal(isLikelyTextRegion({ ...base, confidence: 20, replacement: "保留这个" }), true);
  assert.equal(isLikelyTextRegion({ ...base, confidence: undefined, source: "manual" }), true);
});
