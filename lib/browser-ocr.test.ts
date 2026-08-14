import assert from "node:assert/strict";
import test from "node:test";
import { ocrLinesToRegions } from "./browser-ocr.ts";

test("ocrLinesToRegions turns pixel boxes into proportional editable regions", () => {
  assert.deepEqual(
    ocrLinesToRegions(
      [
        { text: "  今日特价  ", confidence: 92, bbox: { x0: 200, y0: 100, x1: 600, y1: 180 } },
        { text: "   ", confidence: 99, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
      ],
      1000,
      500,
    ),
    [
      {
        id: "ocr-0",
        text: "今日特价",
        replacement: "",
        confidence: 92,
        box: { x: 0.2, y: 0.2, width: 0.4, height: 0.16 },
        source: "ocr",
      },
    ],
  );
});

test("ocrLinesToRegions removes OCR spacing between Chinese characters", () => {
  const [region] = ocrLinesToRegions(
    [{ text: "你 好 , 想 创 作 什 么 ?", confidence: 90, bbox: { x0: 0, y0: 0, x1: 400, y1: 40 } }],
    800,
    400,
  );

  assert.equal(region.text, "你好, 想创作什么?");
});

test("ocrLinesToRegions rejects missing image dimensions", () => {
  assert.throws(() => ocrLinesToRegions([], 0, 100), /图片尺寸/);
});
