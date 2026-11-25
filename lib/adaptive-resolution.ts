export function modelSuffixResolution(modelId: string) {
  const suffix = /(?:^|[-_/\s])([24])k$/i.exec(modelId.trim())?.[1];
  return suffix ? `${suffix}K` : undefined;
}

export function availableResolutions(
  apiSource: string,
  imageUpscale: boolean,
) {
  const fixed = imageUpscale ? ["2K", "4K"] : ["1K", "2K", "4K"];
  return apiSource === "apilio" ? ["自适应", ...fixed] : fixed;
}

export function outputResolutionForSelection(
  apiSource: string,
  resolution: string,
  modelId: string,
) {
  if (apiSource !== "apilio" || resolution !== "自适应")
    return resolution;
  const nativeResolution = modelId.match(/(?:^|[-_/])(1k|2k|4k)(?:$|[-_/])/i)?.[1];
  return nativeResolution?.toUpperCase();
}
