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
      "第1张图是唯一的干净原图和最终编辑底图；第2张图是产品定位图，只用于确定要处理的产品区域。",
      "定位图是纯色示意：白色区域标示产品，灰色区域标示接触融合区域，黑色是无关区域；定位图不包含原图像素，其颜色、边框和标签不得出现在结果中。",
    ] : []),
    "只处理所选产品与周围环境的光影融合关系，保持原图构图、镜头、宽高比和产品数量。",
    "不增加、删除、替换或复制产品；除产品及其附近承载面必要的光影外，不得修改背景。",
  ];
  const standardPrompt = [
    "采用统一产品溶图标准：保持产品轮廓、比例、结构、材质属性、固有色识别、Logo、包装文字与图案。原产品图中的高光、阴影、明暗分布和白平衡不属于保护内容。",
    "首要任务：以第1张图的背景为照明参考，必须替换原有产品光影，重新建立整个产品表面的亮面、暗面、高光、色温和环境染色，让亮暗面、高光位置、环境色和反弹光产生真实变化。必须让产品明显但自然地接受场景光，不能只增加地面阴影。",
    "根据场景光源和承载面，为产品生成自然的接触阴影、投影和必要反射，使产品真实落地。",
    "消除产品与环境之间的视觉接缝，提升整体环境融合度；保持原图构图和背景不变，不重新设计产品，不添加装饰元素，不要改变原图风格。",
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
