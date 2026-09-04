type UpscaleReference = { name: string; data: string };
type UpscaleModel = { id: string; name: string; note: string; mark: string };

const imageUpscaleDefaultModel = "gemini-3.1-flash-image-preview-4k";
const imageUpscaleDefaultModelOption: UpscaleModel = {
  id: imageUpscaleDefaultModel,
  name: "Gemini 3.1 Flash Image Preview 4k",
  note: "Apilio · 图片放大默认模型",
  mark: "⚡",
};

export function imageUpscaleModelOptions(models: UpscaleModel[]) {
  return models.some(
    (model) => model.id.toLowerCase().replace(/^google\//, "") === imageUpscaleDefaultModel,
  )
    ? models
    : [imageUpscaleDefaultModelOption, ...models];
}

export function preferredImageUpscaleModel(models: Array<{ id: string }>) {
  return imageUpscaleModelOptions(models as UpscaleModel[]).find(
    (model) => model.id.toLowerCase().replace(/^google\//, "") === imageUpscaleDefaultModel,
  )?.id || "";
}

export function prepareImageUpscaleInput(source: UpscaleReference) {
  return {
    prompt:
      "将输入图片忠实放大并保守地提升清晰度。保持原图的构图、主体、文字、色彩和画面比例不变，不要添加、删除或改变内容。仅做轻度去模糊、降噪和边缘恢复，保留原图已有的真实细节，不生成新细节。保持包装、设备外壳、墙面等平整表面的干净与连续渐变。禁止新增或重构纹理、材质、斑点、颗粒、多边形色块、云状色块和局部明暗变化；禁止过度锐化、塑料感、光晕和伪纹理。",
    references: [source],
  };
}
