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
) {
  const prompt = [
    "将产品自然融入场景，重塑光影和接触关系。产品表面自然反射周围环境色，色调、色温、明暗和景深与场景一致，并产生合理的反弹光、接触阴影及必要倒影，看起来原本就在这个环境中，避免贴图感。不改变产品外观，不改变背景。",
  ];
  const extra = additionalPrompt.trim() ? [`用户补充要求：${additionalPrompt.trim()}`] : [];
  return [...prompt, ...extra].join("\n");
}

export function prepareProductBlendInput(state: ProductBlendState, maskData: string): {
  prompt: string;
  references: Reference[];
} {
  return {
    prompt: buildProductBlendPrompt(state.additionalPrompt),
    references: [
      state.sourceImage,
      { name: "产品编辑蒙版.png", data: maskData, transient: true, role: "mask" },
    ],
  };
}
