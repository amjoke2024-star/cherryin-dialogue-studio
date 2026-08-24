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

export function buildProductBlendPrompt(
  style: ProductBlendStyle,
  additionalPrompt: string,
  options: { hasGuide?: boolean } = {},
) {
  const common = [
    ...(options.hasGuide ? [
      "第1张图是唯一的干净原图和最终编辑底图；第2张图是产品定位图，只用于确定要处理的产品区域。",
      "定位图中的青色框标示产品区域，橙色框标示接触融合区域；遮罩、边框、标签和标记颜色不得出现在结果中。",
    ] : []),
    "只处理所选产品与周围环境的光影融合关系，保持原图构图、镜头、宽高比和产品数量。",
    "不增加、删除、替换或复制产品；允许改动产品附近承载面上必要的接触阴影、投影和反射，除此之外不得修改背景。",
  ];
  const stylePrompt = style === "realistic-lighting"
    ? [
        "采用真实校光：严格保持产品轮廓、比例、结构、颜色、Logo、包装文字与图案。",
        "先分析背景的主光方向、光线软硬、亮度、色温和环境色，再统一产品全部受光关系；禁止出现与环境主光方向矛盾的高光、亮边或明暗渐变。",
        "在产品底部与承载面相接处生成紧贴轮廓的接触暗部和空间遮蔽；投影方向必须与背景主光方向一致，并随距离自然变软、变淡。",
        "根据承载面材质生成克制、真实的反射：光滑表面保留模糊倒影或亮度回馈，粗糙表面只保留柔和色光与明暗回馈，不制造镜面效果。",
        "产品表面的高光、漫反射、环境染色和轮廓光必须共同服从同一组环境光源逻辑。",
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
