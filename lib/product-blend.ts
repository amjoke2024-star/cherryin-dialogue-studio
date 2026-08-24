import type { NormalizedBox } from "./text-edit.ts";

export type ProductBlendStyle = "realistic-lighting" | "visual-priority";
export type ProductBlendState = {
  sourceImage: { name: string; data: string };
  productBox: NormalizedBox;
  blendStyle?: ProductBlendStyle;
  additionalPrompt: string;
};

type Reference = { name: string; data: string; transient?: boolean; role?: "mask" };

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

export function productBlendMaskRegions(box: NormalizedBox, width: number, height: number) {
  return [
    { role: "contact" as const, ...productBlendContactGeometry(box, width, height) },
    { role: "product" as const, ...productBlendGuideGeometry(box, width, height) },
  ];
}

export function buildProductBlendPrompt(
  additionalPrompt: string,
  options: { hasMask?: boolean } = {},
) {
  const common = [
    ...(options.hasMask ? [
      "原图是唯一的编辑底图；编辑蒙版已限定必须重新处理的产品和接触区域，蒙版外保持不变。",
    ] : []),
    "只处理所选产品与周围环境的光影融合关系，保持原图构图、镜头、宽高比和产品数量。",
    "不增加、删除、替换或复制产品；除产品及其附近承载面必要的光影外，不得修改背景。",
  ];
  const standardPrompt = [
    "采用统一产品溶图标准：保持产品身份、轮廓、比例、结构、材质属性、Logo、包装文字与图案。原产品图中的高光、阴影、明暗分布和白平衡不属于保护内容。",
    "首要任务：以原图背景为照明参考，必须替换原有产品光影，重新建立整个产品表面的亮面、暗面、高光、色温和环境染色，让亮暗面、高光位置、环境色和反弹光产生真实变化。必须让产品明显但自然地接受场景光，不能只增加地面阴影。",
    "白色、黑色和金属表面都必须出现与场景一致且可见的环境色、反弹光和光源反射；受光变化不是重新着色产品。",
    "根据场景光源和承载面，为产品生成自然的接触阴影、投影和必要反射，使产品真实落地。",
    "消除产品与环境之间的视觉接缝，提升整体环境融合度；保持原图构图和背景不变，不重新设计产品，不添加装饰元素，不要改变原图风格。",
  ];
  const extra = additionalPrompt.trim() ? [`用户补充要求：${additionalPrompt.trim()}`] : [];
  return [...common, ...standardPrompt, ...extra].join("\n");
}

export function prepareProductBlendInput(state: ProductBlendState, maskData: string): {
  prompt: string;
  references: Reference[];
} {
  return {
    prompt: buildProductBlendPrompt(state.additionalPrompt, { hasMask: true }),
    references: [
      state.sourceImage,
      { name: "产品编辑蒙版.png", data: maskData, transient: true, role: "mask" },
    ],
  };
}
