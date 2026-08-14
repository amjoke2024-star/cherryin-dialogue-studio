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
  confidence?: number;
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

export function isLikelyTextRegion(region: TextRegion): boolean {
  if (region.source === "manual" || region.replacement.trim()) return true;
  if (typeof region.confidence === "number" && region.confidence < 45) return false;
  if (region.box.width * region.box.height > 0.14) return false;

  const characters = Array.from(region.text.replace(/\s/gu, ""));
  const meaningful = characters.filter((character) =>
    /[\p{Script=Han}\p{Letter}\p{Number}]/u.test(character),
  ).length;
  if (!meaningful) return false;
  return meaningful / characters.length >= 0.45;
}

export function textEditGuideRegions(regions: TextRegion[]) {
  return regions
    .filter((region) => {
      const replacement = region.replacement.trim();
      return Boolean(replacement) && replacement !== region.text.trim();
    })
    .map((region, index) => ({ number: index + 1, region }));
}

export function persistentTextEditReferences<T extends { transient?: boolean }>(
  references: T[],
): T[] {
  return references.filter((item) => !item.transient);
}

export function shouldCollapseTextEditWorkspace(
  isTextEdit: boolean,
  isRepeat: boolean,
): boolean {
  return isTextEdit && !isRepeat;
}

export function shouldDismissTextEditWorkspace(
  expanded: boolean,
  hasImage: boolean,
  pointerInside: boolean,
): boolean {
  return expanded && hasImage && !pointerInside;
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

export function buildTextEditPrompt(
  regions: TextRegion[],
  options: { hasGuide?: boolean } = {},
): string {
  const edits = textEditGuideRegions(regions);

  const instructions = edits.map(({ number, region }) => {
    const original = region.text.trim();
    const replacement = region.replacement.trim();
    const action = original
      ? `将“${original}”替换为“${replacement}”`
      : `将所选文字替换为“${replacement}”`;
    const target = options.hasGuide
      ? `第2张定位图的标记框 ${number}（图片${locationName(region.box)}）`
      : `图片${locationName(region.box)}`;
    return `${number}. 在${target}，${action}。`;
  });

  return [
    ...(options.hasGuide
      ? [
          "第1张图是唯一的干净原图和最终编辑底图；第2张图是带编号框的定位图，只用于指出修改位置。",
          "必须以第1张图为基础，只修改第2张定位图中明确标出的区域。",
        ]
      : []),
    "请只修改以下指定文字：",
    ...instructions,
    "保持原有字体观感、颜色、大小、排版、间距、阴影、透视和背景纹理自然一致，其他内容保持不变。",
    ...(options.hasGuide
      ? ["定位图中的边框、编号和标记颜色不得出现在结果中。"]
      : []),
  ].join("\n");
}
