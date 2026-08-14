"use client";

import { normalizeRegion, type TextRegion } from "./text-edit.ts";

type RawOcrLine = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type OcrWorker = {
  recognize(
    image: File | string,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>,
  ): Promise<{
    data: {
      blocks: Array<{
        paragraphs: Array<{ lines: RawOcrLine[] }>;
      }> | null;
    };
  }>;
  terminate(): Promise<unknown>;
};

let workerPromise: Promise<OcrWorker> | null = null;
let progressListener: ((value: number) => void) | undefined;

function cleanOcrText(value: string) {
  return value
    .trim()
    .replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, "$1")
    .replace(/\s+([，。！？,.!?：:；;])/g, "$1");
}

export function ocrLinesToRegions(
  lines: RawOcrLine[],
  imageWidth: number,
  imageHeight: number,
): TextRegion[] {
  if (imageWidth <= 0 || imageHeight <= 0) {
    throw new Error("无法读取图片尺寸。");
  }

  return lines.flatMap((line, index) => {
    const text = cleanOcrText(line.text);
    const width = line.bbox.x1 - line.bbox.x0;
    const height = line.bbox.y1 - line.bbox.y0;
    if (!text || width <= 0 || height <= 0) return [];

    return [{
      id: `ocr-${index}`,
      text,
      replacement: "",
      confidence: line.confidence,
      box: normalizeRegion({
        x: line.bbox.x0 / imageWidth,
        y: line.bbox.y0 / imageHeight,
        width: width / imageWidth,
        height: height / imageHeight,
      }),
      source: "ocr" as const,
    }];
  });
}

async function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(async ({ createWorker }) => {
      return createWorker("chi_sim", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/",
        langPath: "/ocr/",
        logger: ({ progress }: { progress: number }) => {
          progressListener?.(Math.min(1, Math.max(0, progress)));
        },
      }) as unknown as OcrWorker;
    });
  }
  return workerPromise;
}

async function imageSize(image: File | string) {
  const blob = image instanceof File ? image : await fetch(image).then((response) => {
    if (!response.ok) throw new Error("无法读取待识别图片。");
    return response.blob();
  });
  const bitmap = await createImageBitmap(blob);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

export async function recognizeImageText(
  image: File | string,
  onProgress?: (value: number) => void,
): Promise<TextRegion[]> {
  progressListener = onProgress;
  onProgress?.(0);
  try {
    const [worker, dimensions] = await Promise.all([getWorker(), imageSize(image)]);
    const result = await worker.recognize(image, {}, { blocks: true, text: true });
    const lines = (result.data.blocks || []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) => paragraph.lines),
    );
    onProgress?.(1);
    return ocrLinesToRegions(lines, dimensions.width, dimensions.height);
  } finally {
    progressListener = undefined;
  }
}

export async function terminateOcr(): Promise<void> {
  const current = workerPromise;
  workerPromise = null;
  progressListener = undefined;
  if (current) await (await current).terminate();
}
