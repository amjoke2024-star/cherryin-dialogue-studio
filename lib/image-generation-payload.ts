type ImageGenerationPayloadOptions = {
  providerName: string;
  model: string;
  prompt: string;
  size: string | undefined;
  quality: string;
  count: number;
  responseFormat: "url" | "b64_json";
};

const geminiRatios: Array<[string, number]> = [
  ["1:8", 1 / 8],
  ["1:4", 1 / 4],
  ["2:3", 2 / 3],
  ["3:4", 3 / 4],
  ["4:5", 4 / 5],
  ["1:1", 1],
  ["5:4", 5 / 4],
  ["4:3", 4 / 3],
  ["3:2", 3 / 2],
  ["16:9", 16 / 9],
  ["21:9", 21 / 9],
  ["4:1", 4],
  ["8:1", 8],
];

export function buildImageGenerationPayload({
  providerName,
  model,
  prompt,
  size,
  quality,
  count,
  responseFormat,
}: ImageGenerationPayloadOptions) {
  const base = {
    model,
    prompt,
    n: count,
    response_format: responseFormat,
  };

  if (providerName === "Apilio" && isGeminiImageModel(model)) {
    const { aspectRatio, imageSize } = geminiOutputConfig(size);
    const compatibleQuality = imageSize === "2K" ? "high" : imageSize === "1K" ? "medium" : imageSize;
    return { ...base, size: aspectRatio, quality: compatibleQuality };
  }

  return { ...base, quality, ...(size ? { size } : {}) };
}

function isGeminiImageModel(model: string) {
  return /^(?:google\/)?gemini-.*-image(?:[-._a-z0-9]*)$/i.test(model);
}

function geminiOutputConfig(size: string | undefined) {
  const match = size?.match(/^(\d+)x(\d+)$/);
  const width = Number(match?.[1] || 1024);
  const height = Number(match?.[2] || 1024);
  const target = width / height;
  const aspectRatio = geminiRatios.reduce((best, current) =>
    Math.abs(current[1] - target) < Math.abs(best[1] - target) ? current : best,
  )[0];
  const imageSize = Math.max(width, height) >= 3500
    ? "4K"
    : Math.max(width, height) >= 1800
      ? "2K"
      : "1K";
  return { aspectRatio, imageSize };
}
