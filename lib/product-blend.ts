import type { NormalizedBox } from "./text-edit.ts";

export type ProductBlendStyle = "realistic-lighting" | "visual-priority";
export type ProductBlendState = {
  sourceImage: { name: string; data: string };
  productBox: NormalizedBox;
  blendStyle?: ProductBlendStyle;
  additionalPrompt: string;
};

type Reference = { name: string; data: string; transient?: boolean };

export function isValidProductBox(box: NormalizedBox | null): box is NormalizedBox {
  return Boolean(box && box.width >= 0.01 && box.height >= 0.01);
}

export function persistentProductBlendReferences<T extends { transient?: boolean }>(references: T[]) {
  return references.filter((reference) => !reference.transient);
}

export function shouldCollapseProductBlendWorkspace(isProductBlend: boolean, isRepeat: boolean) {
  return isProductBlend && !isRepeat;
}

export function productBlendGuideGeometry(box: NormalizedBox, width: number, height: number) {
  return {
    x: Math.round(box.x * width),
    y: Math.round(box.y * height),
    width: Math.round(box.width * width),
    height: Math.round(box.height * height),
  };
}

export function productBlendContactGeometry(box: NormalizedBox, width: number, height: number) {
  const left = Math.max(0, box.x - box.width * 0.25);
  const right = Math.min(1, box.x + box.width * 1.25);
  const top = Math.max(0, Math.min(1, box.y + box.height * 0.88));
  const bottom = Math.min(1, top + box.height * 0.57);
  return {
    x: Math.round(left * width),
    y: Math.round(top * height),
    width: Math.round((right - left) * width),
    height: Math.round((bottom - top) * height),
  };
}

export function productBlendGuideLayers(box: NormalizedBox, width: number, height: number) {
  return [
    { role: "background" as const, x: 0, y: 0, width, height, color: "#050607" },
    { role: "contact" as const, ...productBlendContactGeometry(box, width, height), color: "#6b7280" },
    { role: "product" as const, ...productBlendGuideGeometry(box, width, height), color: "#ffffff" },
  ];
}

export function buildProductBlendPrompt(
  additionalPrompt: string,
  options: { hasGuide?: boolean } = {},
) {
  const common = [
    ...(options.hasGuide ? [
      "第1张图是唯一的原图和最终编辑底图；第2张图是纯色定位参考：白色为产品区域、灰色为接触区域、黑色为无关区域，定位图的颜色不得出现在结果中。",
    ] : []),
    "只处理所选产品与周围环境的光影融合关系，保持原图构图、镜头、宽高比和产品数量。",
    "不增加、删除、替换或复制产品；除产品及其附近承载面必要的光影外，不得修改背景。",
  ];
  const standardPrompt = [
    "采用统一产品溶图标准：保持产品身份、轮廓、比例、结构、材质属性、Logo、包装文字与图案。原产品图中的高光、阴影、明暗分布和白平衡不属于保护内容。",
    "首要任务：以第1张图背景为照明参考，校正整个产品表面的亮面、暗面、高光、色温和环境染色。环境光影响必须清晰可见且自然，形成符合产品曲面和主光方向的连续明暗与冷暖变化；不得仅通过整体压暗或提亮产品来表现融合。",
    "受光面应明确接受场景主光色，暗面和底部应呈现合理的环境色与承载面反弹光；白色、黑色和金属表面的高光与反射必须服从场景光源。所有色彩变化必须平滑、通透，不得形成污渍、云斑、块状染色、颗粒、噪点或不规则涂抹；受光变化不是重新着色产品，仅增加地面阴影属于失败。",
    "投影方向必须与主光方向一致；接触阴影在接触处最深，向外自然变软变淡，并随承载面的高度、凹凸和遮挡关系变形。保留必要反射，不得形成均匀黑边或悬浮感。",
    "消除产品与环境之间的视觉接缝，提升整体环境融合度；保持背景原有的平滑渐变与干净表面，不增加任何纹理；保持原图构图和背景内容不变，不重新设计产品，不添加装饰元素，不要改变原图风格。",
  ];
  const extra = additionalPrompt.trim() ? [`用户补充要求：${additionalPrompt.trim()}`] : [];
  return [...common, ...standardPrompt, ...extra].join("\n");
}

export function prepareProductBlendInput(state: ProductBlendState, guideData: string): {
  prompt: string;
  references: Reference[];
} {
  return {
    prompt: buildProductBlendPrompt(state.additionalPrompt, { hasGuide: true }),
    references: [
      state.sourceImage,
      { name: "产品定位图.png", data: guideData, transient: true },
    ],
  };
}
