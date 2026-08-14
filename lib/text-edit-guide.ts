"use client";

import { textEditGuideRegions, type TextRegion } from "./text-edit";

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取原图，定位图生成失败"));
    image.src = source;
  });
}

export async function createTextEditGuideImage(
  source: string,
  regions: TextRegion[],
): Promise<string> {
  const marks = textEditGuideRegions(regions);
  if (!marks.length) throw new Error("没有需要定位的文字区域");

  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法创建定位图");

  context.drawImage(image, 0, 0);
  const shortestSide = Math.min(canvas.width, canvas.height);
  const lineWidth = Math.max(4, Math.round(shortestSide * 0.006));
  const radius = Math.max(18, Math.round(shortestSide * 0.026));
  context.font = `700 ${Math.round(radius * 1.08)}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (const { number, region } of marks) {
    const x = region.box.x * canvas.width;
    const y = region.box.y * canvas.height;
    const width = region.box.width * canvas.width;
    const height = region.box.height * canvas.height;
    const badgeX = Math.min(canvas.width - radius, Math.max(radius, x));
    const badgeY = Math.min(canvas.height - radius, Math.max(radius, y));

    context.save();
    context.strokeStyle = "rgba(255,255,255,0.95)";
    context.lineWidth = lineWidth * 2.4;
    context.strokeRect(x, y, width, height);
    context.strokeStyle = "#ff2d2d";
    context.lineWidth = lineWidth;
    context.strokeRect(x, y, width, height);
    context.fillStyle = "#ff2d2d";
    context.beginPath();
    context.arc(badgeX, badgeY, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#fff";
    context.lineWidth = Math.max(2, lineWidth * 0.55);
    context.stroke();
    context.fillStyle = "#fff";
    context.fillText(String(number), badgeX, badgeY + 1);
    context.restore();
  }

  return canvas.toDataURL("image/png");
}
