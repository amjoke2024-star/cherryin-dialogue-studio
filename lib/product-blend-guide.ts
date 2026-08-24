import {
  isValidProductBox,
  productBlendGuideLayers,
} from "./product-blend";
import type { NormalizedBox } from "./text-edit";

export async function createProductBlendGuideImage(imageData: string, box: NormalizedBox) {
  if (!isValidProductBox(box)) throw new Error("请重新框选有效的产品区域");
  const image = await loadImage(imageData);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法创建产品定位图");
  for (const layer of productBlendGuideLayers(box, canvas.width, canvas.height)) {
    context.fillStyle = layer.color;
    context.fillRect(layer.x, layer.y, layer.width, layer.height);
  }
  return canvas.toDataURL("image/png");
}

function loadImage(data: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取产品场景图"));
    image.src = data;
  });
}
