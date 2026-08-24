import {
  isValidProductBox,
  productBlendContactGeometry,
  productBlendGuideGeometry,
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
  context.drawImage(image, 0, 0);
  const area = productBlendGuideGeometry(box, canvas.width, canvas.height);
  const contactArea = productBlendContactGeometry(box, canvas.width, canvas.height);
  context.fillStyle = "rgba(0, 0, 0, 0.52)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    contactArea.x,
    contactArea.y,
    contactArea.width,
    contactArea.height,
    contactArea.x,
    contactArea.y,
    contactArea.width,
    contactArea.height,
  );
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    area.x,
    area.y,
    area.width,
    area.height,
  );
  const lineWidth = Math.max(3, Math.round(Math.min(canvas.width, canvas.height) * 0.006));
  context.strokeStyle = "#f59e0b";
  context.lineWidth = lineWidth;
  context.setLineDash([lineWidth * 2, lineWidth * 1.5]);
  context.strokeRect(contactArea.x, contactArea.y, contactArea.width, contactArea.height);
  context.setLineDash([]);
  context.strokeStyle = "#16c7df";
  context.lineWidth = lineWidth;
  context.strokeRect(area.x, area.y, area.width, area.height);
  const fontSize = Math.max(20, Math.round(Math.min(canvas.width, canvas.height) * 0.035));
  context.font = `700 ${fontSize}px Arial, sans-serif`;
  drawLabel(context, "接触融合区域", contactArea.x, contactArea.y, fontSize, "#f59e0b");
  drawLabel(context, "产品区域", area.x, area.y, fontSize, "#16c7df");
  return canvas.toDataURL("image/png");
}

function drawLabel(
  context: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  fontSize: number,
  color: string,
) {
  const labelWidth = context.measureText(label).width + fontSize;
  const labelY = Math.max(fontSize * 1.3, y);
  context.fillStyle = color;
  context.fillRect(x, labelY - fontSize * 1.2, labelWidth, fontSize * 1.35);
  context.fillStyle = "#071418";
  context.fillText(label, x + fontSize * 0.5, labelY - fontSize * 0.18);
}

function loadImage(data: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取产品场景图"));
    image.src = data;
  });
}
