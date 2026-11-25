const maxEdge = 3840;
const maxPixels = 8_294_400;

export function usesGptImage2SizeLimits(model?: string) {
  return /(?:^|\/)gpt-image-2(?:\.[56])?(?:-|$)/i.test(model ?? "");
}

export function normalizeGptImage2Size(model: string, size: string | undefined) {
  if (!usesGptImage2SizeLimits(model) || !size) return size;
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return size;
  const requestedWidth = Number(match[1]);
  const requestedHeight = Number(match[2]);
  const withinLimits = requestedWidth <= maxEdge
    && requestedHeight <= maxEdge
    && requestedWidth * requestedHeight <= maxPixels
    && requestedWidth % 16 === 0
    && requestedHeight % 16 === 0;
  if (withinLimits) return size;
  return fitGptImage2Size(requestedWidth / requestedHeight);
}

export function fitGptImage2Size(aspectRatio: number) {
  const ratio = Math.min(3, Math.max(1 / 3, aspectRatio));
  if (ratio >= 1) {
    const width = Math.floor(Math.min(maxEdge, Math.sqrt(maxPixels * ratio)) / 16) * 16;
    const height = Math.floor((width / ratio) / 16) * 16;
    return `${width}x${height}`;
  }
  const height = Math.floor(Math.min(maxEdge, Math.sqrt(maxPixels / ratio)) / 16) * 16;
  const width = Math.floor((height * ratio) / 16) * 16;
  return `${width}x${height}`;
}
