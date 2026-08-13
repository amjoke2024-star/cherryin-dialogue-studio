import { NextRequest, NextResponse } from "next/server";

type UpstreamModel = {
  id?: string;
  name?: string;
  owned_by?: string;
  type?: string;
  category?: string;
  modalities?: string[];
  supported_modalities?: string[];
  endpoints?: string[];
  supported_endpoint_types?: string[];
};

const imageWords = ["image", "imagen", "flux", "seedream", "seededit", "recraft", "ideogram", "dall-e", "kolors", "hidream", "wan2", "cogview"];
const videoWords = ["i2v", "t2v", "s2v", "kf2v", "video", "animate-mix", "animate_move", "animate-move"];

export async function POST(request: NextRequest) {
  try {
    const { apiKey, apiSource = "cherryin" } = await request.json() as { apiKey?: string; apiSource?: "cherryin" | "apilio" };
    if (!apiKey?.trim()) return NextResponse.json({ models: [] });
    const providerName = apiSource === "apilio" ? "Apilio" : "CherryIN";
    const baseURL = apiSource === "apilio" ? "https://api.apilio.ai" : "https://open.cherryin.net";
    const response = await fetch(`${baseURL}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.json().catch(() => ({})) as { data?: UpstreamModel[]; models?: UpstreamModel[]; error?: { message?: string } };
    if (!response.ok) return NextResponse.json({ error: raw.error?.message || `无法读取 ${providerName} 模型列表` }, { status: response.status });
    const source = Array.isArray(raw.data) ? raw.data : Array.isArray(raw.models) ? raw.models : [];
    const models = Array.from(new Map(source.filter((item) => isImageModel(item) && Boolean(item.id || item.name)).map((item) => {
      const id = String(item.id || item.name);
      return [id, {
        id,
        name: displayName(id),
        note: item.owned_by ? `${providerName} · ${item.owned_by}` : `${providerName} 图片模型`,
        mark: "◇",
      }] as const;
    })).values()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "模型列表读取失败" }, { status: 500 });
  }
}

function isImageModel(model: UpstreamModel) {
  const fields = [model.id, model.name, model.type, model.category, ...(model.modalities || []), ...(model.supported_modalities || []), ...(model.endpoints || []), ...(model.supported_endpoint_types || [])].filter(Boolean).join(" ").toLowerCase();
  if (videoWords.some((word) => fields.includes(word))) return false;
  return imageWords.some((word) => fields.includes(word)) || fields.includes("images/generations") || fields.includes("images/edits");
}

function displayName(id: string) {
  const name = id.split("/").pop()?.replace(/\(free\)/gi, "（免费）").replace(/[-_]/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()) || id;
  return name.replace(/^Doubao (Seedream|Seededit)/i, "即梦 $1");
}
