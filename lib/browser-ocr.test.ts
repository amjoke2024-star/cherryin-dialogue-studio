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
        box: { x: 0.2, y: 0.2, width: 0.4, height: 0.16 },
        source: "ocr",
      },
    ],
  );
});

test("ocrLinesToRegions rejects missing image dimensions", () => {
  assert.throws(() => ocrLinesToRegions([], 0, 100), /图片尺寸/);
});
