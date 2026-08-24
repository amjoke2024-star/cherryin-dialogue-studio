import type { NormalizedBox } from "./text-edit.ts";

export type ProductBlendStyle = "realistic-lighting" | "visual-priority";
export type ProductBlendStep = "select-region" | "choose-style";
export type ProductBlendState = {
  sourceImage: { name: string; data: string };
  productBox: NormalizedBox;
  blendStyle: ProductBlendStyle;
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

export function buildProductBlendPrompt(
  style: ProductBlendStyle,
  additionalPrompt: string,
  options: { hasGuide?: boolean } = {},
) {
  const common = [
    ...(options.hasGuide ? [
      "第1张图是唯一的干净原图和最终编辑底图；第2张图是产品定位图，只用于确定要处理的产品区域。",
      "定位图中的遮罩、边框、标签和标记颜色不得出现在结果中。",
    ] : []),
    "只处理所选产品与周围环境的光影融合关系，保持原图构图、镜头、宽高比和产品数量。",
    "不增加、删除、替换或复制产品，不无故修改选区外的背景内容。",
  ];
  const stylePrompt = style === "realistic-lighting"
    ? [
        "采用真实校光：严格保持产品轮廓、比例、结构、颜色、Logo、包装文字与图案。",
        "分析背景的主光方向、光线软硬、亮度、色温和环境色，只调整产品的明暗、高光、漫反射、环境染色、接触阴影和空间遮蔽。",
        "让产品像在该环境中真实拍摄，不重新设计产品，不添加装饰元素。",
      ]
    : [
        "采用视觉优先：保持产品主体、品牌和核心包装信息清晰可辨。",
        "允许加强轮廓光、高光、反射、材质表现、环境色和广告氛围，使画面具有精致的商业摄影效果。",
        "禁止无意义变形、产品重复、Logo 替换和包装文字乱码。",
      ];
  const extra = additionalPrompt.trim() ? [`用户补充要求：${additionalPrompt.trim()}`] : [];
  return [...common, ...stylePrompt, ...extra].join("\n");
}

export function prepareProductBlendInput(state: ProductBlendState, guideData: string): {
  prompt: string;
  references: Reference[];
} {
  return {
    prompt: buildProductBlendPrompt(state.blendStyle, state.additionalPrompt, { hasGuide: true }),
    references: [
      state.sourceImage,
      { name: "产品定位图.png", data: guideData, transient: true },
    ],
  };
}
