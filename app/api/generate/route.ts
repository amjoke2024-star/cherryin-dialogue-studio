import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { studioPath } from "../../../lib/studio-paths";

type Reference = { name: string; data: string };
const timeout = 600_000;
const geminiTimeout = 600_000;
const bflTimeout = 600_000;

function normalizeGptImage2Size(model: string, size: string | undefined) {
  if (!/(?:^|\/)gpt-image-2(?:-|$)/i.test(model) || !size) return size;
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return size;
  const requestedWidth = Number(match[1]);
  const requestedHeight = Number(match[2]);
  const withinLimits = requestedWidth <= 3840 && requestedHeight <= 3840 && requestedWidth * requestedHeight <= 8_294_400 && requestedWidth % 16 === 0 && requestedHeight % 16 === 0;
  if (withinLimits) return size;
  const ratio = Math.min(3, Math.max(1 / 3, requestedWidth / requestedHeight));
  if (ratio >= 1) {
    const width = Math.floor(Math.min(3840, Math.sqrt(8_294_400 * ratio)) / 16) * 16;
    const height = Math.floor((width / ratio) / 16) * 16;
    return `${width}x${height}`;
  }
  const height = Math.floor(Math.min(3840, Math.sqrt(8_294_400 / ratio)) / 16) * 16;
  const width = Math.floor((height * ratio) / 16) * 16;
  return `${width}x${height}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { apiKey?: string; apiSource?: "cherryin" | "apilio" | "bfl"; prompt?: string; model?: string; size?: string; quality?: string; count?: number; references?: Reference[]; archiveReferences?: boolean };
    const { apiKey, apiSource = "cherryin", prompt, model = "openai/gpt-image-2", size, quality = "medium", count = 1, references = [], archiveReferences = true } = body;
    if (!apiKey?.trim() || !prompt?.trim()) return NextResponse.json({ error: "请填写 API Key 和创作指令。" }, { status: 400 });
    const providerSize = normalizeGptImage2Size(model, size);
    if (model.startsWith("bfl/")) {
      const batches = await Promise.all(Array.from({ length: count }, () => requestBfl(apiKey.trim(), model.slice(4), prompt, size, references)));
      const archivedReferences = archiveReferences ? await Promise.all(references.map(saveReference)) : undefined;
      return NextResponse.json({ images: batches, references: archivedReferences });
    }
    if (apiSource === "cherryin" && isGeminiImageModel(model)) {
      const batches = await Promise.all(Array.from({ length: count }, () => requestGemini(apiKey.trim(), model, prompt, size, references)));
      const archivedReferences = archiveReferences ? await Promise.all(references.map(saveReference)) : undefined;
      return NextResponse.json({ images: batches.flat(), references: archivedReferences });
    }
    if (references.length) {
      // Several CherryIN edit models ignore n and always return one image.
      // Run one edit request per requested result so the selected count is reliable.
      const batches = await Promise.all(Array.from({ length: count }, () => requestEdit(apiKey.trim(), apiSource, model, prompt, providerSize, quality, references)));
      const archivedReferences = archiveReferences ? await Promise.all(references.map(saveReference)) : undefined;
      return NextResponse.json({ images: batches.flat(), references: archivedReferences });
    }
    // Apilio can finish the upstream generation but fail while proxying a large
    // 2K/4K base64 response. Ask it for a lightweight URL and download the
    // image separately; this avoids retrying the paid generation itself.
    const baseURL = apiSource === "apilio" ? "https://api.apilio.ai" : "https://open.cherryin.net";
    const providerName = apiSource === "apilio" ? "Apilio" : "CherryIN";
    // Apilio's GPT Image routes ignore n > 1. Submit one paid generation per
    // requested image so the UI count matches the actual number of results.
    if (apiSource === "apilio" && count > 1) {
      const settled = await Promise.allSettled(Array.from({ length: count }, () => requestGeneration(apiKey.trim(), baseURL, providerName, model, prompt, providerSize, quality, 1, "url")));
      const images = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      if (images.length) return NextResponse.json({ images, requestedCount: count, completedCount: images.length });
      const firstError = settled.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason;
      throw firstError instanceof Error ? firstError : new Error("Apilio 没有返回图片。");
    }
    const responseFormat = apiSource === "apilio" ? "url" : "b64_json";
    const images = await requestGeneration(apiKey.trim(), baseURL, providerName, model, prompt, providerSize, quality, count, responseFormat);
    if (!images.length) return NextResponse.json({ error: `${providerName} 没有返回图片。` }, { status: 502 });
    return NextResponse.json({ images });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return NextResponse.json({ error: "生成请求响应超时，请稍后重试或改用更低分辨率。" }, { status: 504 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "连接 CherryIN 失败。" }, { status: 500 });
  }
}

async function requestGeneration(apiKey: string, baseURL: string, providerName: string, model: string, prompt: string, size: string | undefined, quality: string, count: number, responseFormat: "url" | "b64_json") {
  const payload = { model, prompt, quality, n: count, response_format: responseFormat, ...(size ? { size } : {}) };
  const response = await fetch(`${baseURL}/v1/images/generations`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeout) });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!response.ok) throw new Error(getError(data, response.status, providerName));
  const entries = Array.isArray(data.data) ? data.data : Array.isArray(data.images) ? data.images : [];
  return Promise.all(entries.map(normalize));
}

async function requestBfl(apiKey: string, endpoint: string, prompt: string, size: string | undefined, references: Reference[]) {
  const supported = new Set(["flux-2-pro-preview", "flux-2-max", "flux-2-klein-4b", "flux-kontext-pro"]);
  if (!supported.has(endpoint)) throw new Error("画室尚未启用这个 Black Forest Labs 模型。");
  const dimensions = bflDimensions(size);
  const payload: Record<string, unknown> = { prompt, output_format: "png" };
  if (endpoint === "flux-kontext-pro") payload.aspect_ratio = dimensions.aspectRatio;
  else { payload.width = dimensions.width; payload.height = dimensions.height; }
  const inputs = await Promise.all(references.slice(0, endpoint === "flux-kontext-pro" ? 1 : 8).map(toBflInput));
  inputs.forEach((input, index) => { payload[index ? `input_image_${index + 1}` : "input_image"] = input; });
  const response = await fetch(`https://api.bfl.ai/v1/${endpoint}`, {
    method: "POST",
    headers: { "x-key": apiKey, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const submitted = await response.json().catch(() => ({})) as { polling_url?: string; detail?: unknown; error?: string };
  if (!response.ok || !submitted.polling_url) throw new Error(bflError(submitted, response.status));
  const startedAt = Date.now();
  for (;;) {
    if (Date.now() - startedAt > bflTimeout) throw new Error("FLUX 生成超过 10 分钟，请稍后重试。");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const resultResponse = await fetch(submitted.polling_url, { headers: { "x-key": apiKey, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const result = await resultResponse.json().catch(() => ({})) as { status?: string; result?: { sample?: string }; error?: string; detail?: unknown };
    if (!resultResponse.ok) throw new Error(bflError(result, resultResponse.status));
    if (result.status === "Ready" && result.result?.sample) return normalize({ url: result.result.sample });
    if (result.status === "Error" || result.status === "Failed") throw new Error(bflError(result, resultResponse.status));
  }
}

function bflDimensions(size: string | undefined) {
  const match = size?.match(/^(\d+)x(\d+)$/);
  let width = Number(match?.[1] || 1024), height = Number(match?.[2] || 1024);
  const scale = Math.min(1, Math.sqrt(4_000_000 / (width * height)));
  width = Math.max(64, Math.round(width * scale / 16) * 16);
  height = Math.max(64, Math.round(height * scale / 16) * 16);
  const divisor = greatestCommonDivisor(width, height);
  return { width, height, aspectRatio: `${width / divisor}:${height / divisor}` };
}

function greatestCommonDivisor(a: number, b: number): number {
  return b ? greatestCommonDivisor(b, a % b) : a;
}

async function toBflInput(item: Reference) {
  if (item.data.startsWith("data:image/")) return item.data;
  const saved = item.data.match(/^\/generated\/([a-zA-Z0-9-]+\.(png|jpg|jpeg|webp))$/);
  if (!saved) throw new Error(`无法读取图片：${item.name}`);
  const bytes = await readFile(studioPath("public", "generated", saved[1]));
  const mime = saved[2] === "webp" ? "image/webp" : saved[2] === "jpg" || saved[2] === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function bflError(data: { detail?: unknown; error?: string }, status: number) {
  if (status === 401 || status === 403) return "Black Forest Labs API Key 无效或无权使用该模型。";
  if (status === 402) return "Black Forest Labs Credits 余额不足。";
  if (status === 429) return "Black Forest Labs 请求太频繁，请稍后再试。";
  return data.error || (typeof data.detail === "string" ? data.detail : "") || `Black Forest Labs 返回错误 ${status}`;
}

function isGeminiImageModel(model: string) {
  return /^google\/gemini-.*-image(?:-preview)?$/i.test(model);
}

async function requestGemini(apiKey: string, model: string, prompt: string, size: string | undefined, references: Reference[]) {
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  parts.push(...await Promise.all(references.map(toGeminiPart)));
  const imageConfig = geminiImageConfig(size);
  const safeModelPath = model.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`https://open.cherryin.net/v1beta/models/${safeModelPath}:generateContent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig },
    }),
    signal: AbortSignal.timeout(geminiTimeout),
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!response.ok) throw new Error(getError(data, response.status));
  const candidates = Array.isArray(data.candidates) ? data.candidates as Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }> } }> : [];
  const imageParts = candidates.flatMap((candidate) => candidate.content?.parts || []).map((part) => part.inlineData || (part.inline_data ? { data: part.inline_data.data, mimeType: part.inline_data.mime_type } : undefined)).filter((item): item is { data: string; mimeType?: string } => Boolean(item?.data));
  const images = await Promise.all(imageParts.map((item) => saveGeneratedImage(Buffer.from(item.data, "base64"), item.mimeType || "image/png")));
  if (!images.length) throw new Error("Gemini 没有返回图片，请确认 CherryIN 的 Gemini 图片通道可用。");
  return images;
}

async function toGeminiPart(item: Reference) {
  const inline = item.data.match(/^data:([^;]+);base64,(.+)$/);
  if (inline) return { inlineData: { mimeType: inline[1], data: inline[2] } };
  const saved = item.data.match(/^\/generated\/([a-zA-Z0-9-]+\.(png|jpg|jpeg|webp))$/);
  if (saved) {
    const bytes = await readFile(studioPath("public", "generated", saved[1]));
    const mimeType = saved[2] === "webp" ? "image/webp" : saved[2] === "jpg" || saved[2] === "jpeg" ? "image/jpeg" : "image/png";
    return { inlineData: { mimeType, data: bytes.toString("base64") } };
  }
  throw new Error(`无法读取图片：${item.name}`);
}

function geminiImageConfig(size: string | undefined) {
  const match = size?.match(/^(\d+)x(\d+)$/);
  const width = Number(match?.[1] || 1024);
  const height = Number(match?.[2] || 1024);
  const imageSize = Math.max(width, height) >= 3500 ? "4K" : Math.max(width, height) >= 1800 ? "2K" : "1K";
  const ratios: Array<[string, number]> = [["21:9", 21 / 9], ["16:9", 16 / 9], ["3:2", 3 / 2], ["4:3", 4 / 3], ["1:1", 1], ["3:4", 3 / 4], ["2:3", 2 / 3], ["9:16", 9 / 16]];
  const target = width / height;
  const aspectRatio = ratios.reduce((best, current) => Math.abs(current[1] - target) < Math.abs(best[1] - target) ? current : best)[0];
  return { aspectRatio, imageSize };
}

async function requestEdit(apiKey: string, apiSource: "cherryin" | "apilio" | "bfl", model: string, prompt: string, size: string | undefined, quality: string, references: Reference[]) {
  const form = new FormData();
  form.append("model", model); form.append("prompt", prompt); if (size) form.append("size", size); form.append("quality", quality); form.append("n", "1");
  const files = await Promise.all(references.map(toFile));
  files.forEach((file) => form.append("image", file));
  const baseURL = apiSource === "apilio" ? "https://api.apilio.ai" : "https://open.cherryin.net";
  const providerName = apiSource === "apilio" ? "Apilio" : "CherryIN";
  const response = await fetch(`${baseURL}/v1/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(timeout) });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!response.ok) throw new Error(getError(data, response.status));
  const entries = Array.isArray(data.data) ? data.data : Array.isArray(data.images) ? data.images : [];
  const images = await Promise.all(entries.map(normalize));
  if (!images.length) throw new Error(`${providerName} 没有返回图片。`);
  return images;
}

async function toFile(item: Reference) {
  const match = item.data.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return new File([Uint8Array.from(Buffer.from(match[2], "base64"))], item.name, { type: match[1] });
  const saved = item.data.match(/^\/generated\/([a-zA-Z0-9-]+\.(png|jpg|jpeg|webp))$/);
  if (saved) {
    const bytes = await readFile(studioPath("public", "generated", saved[1]));
    const type = saved[2] === "webp" ? "image/webp" : saved[2] === "jpg" || saved[2] === "jpeg" ? "image/jpeg" : "image/png";
    return new File([bytes], item.name, { type });
  }
  throw new Error(`无法读取图片：${item.name}`);
}

async function saveReference(item: Reference): Promise<Reference> {
  if (item.data.startsWith("/generated/")) return item;
  const match = item.data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return item;
  return { name: item.name, data: await saveGeneratedImage(Buffer.from(match[2], "base64"), match[1]) };
}

async function normalize(value: unknown) {
  const item = value as { b64_json?: string; url?: string };
  if (item?.b64_json) {
    const dataUrl = item.b64_json.match(/^data:([^;]+);base64,(.+)$/s);
    const contentType = dataUrl?.[1] || "image/png";
    const encoded = dataUrl?.[2] || item.b64_json;
    return saveGeneratedImage(Buffer.from(encoded, "base64"), contentType);
  }
  if (item?.url) {
    let lastStatus = 0;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(item.url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
        lastStatus = response.status;
        if (response.ok) {
          const bytes = await response.arrayBuffer();
          return saveGeneratedImage(Buffer.from(bytes), response.headers.get("content-type") || "image/png");
        }
      } catch (error) {
        if (attempt === 2) throw error;
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
    throw new Error(`图片已生成，但下载失败${lastStatus ? `（${lastStatus}）` : ""}。请勿直接重新生成。`);
  }
  throw new Error("无法识别返回的图片格式。");
}

async function saveGeneratedImage(bytes: Buffer, contentType: string) {
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!isPng && !isJpeg && !isWebp) throw new Error("图片服务返回了无效的图片数据，请重试。");
  const extension = contentType.includes("webp") ? "webp" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  const directory = studioPath("public", "generated");
  await mkdir(directory, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  await writeFile(path.join(directory, filename), bytes);
  return `/generated/${filename}`;
}

function getError(data: Record<string, unknown>, status: number, providerName = "CherryIN") {
  const nested = data.error as { message?: string } | string | undefined;
  const detail = typeof nested === "string" ? nested : nested?.message || String(data.message || "");
  const requestId = detail.match(/request ID\s+([a-zA-Z0-9-]+)/i)?.[1];
  if (status === 401) return "API Key 无效或已过期。";
  if (status === 402) return `${providerName} 余额不足。`;
  if (status === 429) return "请求太频繁，请稍后再试。";
  if (status >= 500) return `${providerName} 图片服务暂时异常。${requestId ? `请求编号：${requestId}` : "请稍后再试。"}`;
  return detail || `${providerName} 返回错误 ${status}`;
}
