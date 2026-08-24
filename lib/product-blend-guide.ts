import { isValidProductBox, productBlendGuideGeometry } from "./product-blend";
import type { NormalizedBox } from "./text-edit";

export async function createProductBlendGuideImage(imageData: string, box: NormalizedBox) {
  if (!isValidProductBox(box)) throw new Error("请重新框选有效的产品区域");
  const image = await loadImage(imageData);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法创建产品定位图");
  context.drawImage(image, 0, 0);
  const area = productBlendGuideGeometry(box, canvas.width, canvas.height);
  context.fillStyle = "rgba(0, 0, 0, 0.52)";
  context.fillRect(0, 0, canvas.width, area.y);
  context.fillRect(0, area.y, area.x, area.height);
  context.fillRect(area.x + area.width, area.y, canvas.width - area.x - area.width, area.height);
  context.fillRect(0, area.y + area.height, canvas.width, canvas.height - area.y - area.height);
  const lineWidth = Math.max(3, Math.round(Math.min(canvas.width, canvas.height) * 0.006));
  context.strokeStyle = "#16c7df";
  context.lineWidth = lineWidth;
  context.strokeRect(area.x, area.y, area.width, area.height);
  const fontSize = Math.max(20, Math.round(Math.min(canvas.width, canvas.height) * 0.035));
  context.font = `700 ${fontSize}px Arial, sans-serif`;
  const label = "产品区域";
  const labelWidth = context.measureText(label).width + fontSize;
  const labelY = Math.max(fontSize * 1.3, area.y);
  context.fillStyle = "#16c7df";
  context.fillRect(area.x, labelY - fontSize * 1.2, labelWidth, fontSize * 1.35);
  context.fillStyle = "#071418";
  context.fillText(label, area.x + fontSize * 0.5, labelY - fontSize * 0.18);
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
