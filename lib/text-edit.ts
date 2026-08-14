export type NormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TextRegion = {
  id: string;
  text: string;
  replacement: string;
  box: NormalizedBox;
  source: "ocr" | "manual";
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const stable = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function normalizeRegion(box: NormalizedBox): NormalizedBox {
  const left = clamp(Math.min(box.x, box.x + box.width));
  const right = clamp(Math.max(box.x, box.x + box.width));
  const top = clamp(Math.min(box.y, box.y + box.height));
  const bottom = clamp(Math.max(box.y, box.y + box.height));

  return {
    x: stable(left),
    y: stable(top),
    width: stable(right - left),
    height: stable(bottom - top),
  };
}

export function hasPendingReplacement(regions: TextRegion[]): boolean {
  return regions.some((region) => {
    const replacement = region.replacement.trim();
    return Boolean(replacement) && replacement !== region.text.trim();
  });
}

function locationName(box: NormalizedBox) {
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const column = x < 1 / 3 ? 0 : x > 2 / 3 ? 2 : 1;
  const row = y < 1 / 3 ? 0 : y > 2 / 3 ? 2 : 1;
  return [
    ["左上区域", "上方区域", "右上区域"],
    ["左侧区域", "中央区域", "右侧区域"],
    ["左下区域", "下方区域", "右下区域"],
  ][row][column];
}

export function buildTextEditPrompt(regions: TextRegion[]): string {
  const edits = regions.filter((region) => {
    const replacement = region.replacement.trim();
    return Boolean(replacement) && replacement !== region.text.trim();
  });

  const instructions = edits.map((region, index) => {
    const original = region.text.trim();
    const replacement = region.replacement.trim();
    const action = original
      ? `将“${original}”替换为“${replacement}”`
      : `将所选文字替换为“${replacement}”`;
    return `${index + 1}. 在图片${locationName(region.box)}，${action}。`;
  });

  return [
    "请只修改以下指定文字：",
    ...instructions,
    "保持原有字体观感、颜色、大小、排版、间距、阴影、透视和背景纹理自然一致，其他内容保持不变。",
  ].join("\n");
}
