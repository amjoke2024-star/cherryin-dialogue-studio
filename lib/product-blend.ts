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

export function buildProductBlendPrompt(
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
  const standardPrompt = [
    "采用统一产品溶图标准：严格保持产品轮廓、比例、结构、颜色、Logo、包装文字与图案。",
    "先识别主光方向、光源数量、光线软硬、强弱和衰减，再分析环境主色、邻近物体反射色、承载面反弹色和整体冷暖倾向；必须依据当前图片得出受光方案，不得套用固定色调、固定光向或固定高光形式。",
    "产品亮面、暗面、高光、轮廓光、漫反射和环境染色必须共同服从场景中的实际光源依据；禁止出现与环境主光方向矛盾的高光、亮边或明暗渐变。柔光环境使用宽而柔的渐变，硬光环境保留明确但合理的方向性。",
    "在保护产品固有颜色的前提下，让产品接受场景中真实存在的环境色与反弹光，同时保持合理的明暗与色彩对比：既不能像未受环境影响的贴图，也不能被环境色吞没。环境染色只能表现为表面受光，不得改变产品固有色、品牌色、Logo 或包装文字。",
    "在产品底部与承载面相接处生成紧贴轮廓的接触暗部和空间遮蔽；投影方向必须与主光方向一致，投影长度、浓度和软硬必须根据光源位置、距离和承载面关系决定，并随距离自然衰减，禁止固定居中或均匀铺开。",
    "根据承载面材质和观察角度生成克制、真实的反射：光滑表面可保留随距离模糊衰减的倒影或亮度回馈，粗糙表面只保留柔和色光与明暗回馈；禁止套用固定长度、固定透明度或完整镜像。",
    "多光源、逆光、彩色灯光或室内暖光场景可以形成复合受光，但每一道明显高光、轮廓光和投影都必须能在环境中找到对应依据。",
    "让产品像在该环境中真实拍摄，不重新设计产品，不添加装饰元素。",
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
