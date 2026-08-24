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
  const prompt = [
    ...(options.hasGuide ? [
      "第1张图是唯一底图；第2张图仅用于定位产品与接触区域，其颜色不得进入结果。",
    ] : []),
    "将产品自然融入场景，重塑光影和接触关系。产品表面自然反射周围环境色，色调、色温、明暗和景深与场景一致，并产生合理的反弹光、接触阴影及必要倒影，看起来原本就在这个环境中，避免贴图感。不改变产品外观，不改变背景。",
  ];
  const extra = additionalPrompt.trim() ? [`用户补充要求：${additionalPrompt.trim()}`] : [];
  return [...prompt, ...extra].join("\n");
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
