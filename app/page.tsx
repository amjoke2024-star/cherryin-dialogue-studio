"use client";

import {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import "./model-grid.css";
import TextEditWorkspace from "./components/TextEditWorkspace";
import { recognizeImageText, terminateOcr } from "../lib/browser-ocr";
import { decideJobTermination, type StudioMode } from "../lib/job-lifecycle";
import {
  buildTextEditPrompt,
  hasPendingReplacement,
  type TextRegion,
} from "../lib/text-edit";

type Attachment = { name: string; data: string };
type TextEditState = { sourceImage: Attachment; regions: TextRegion[] };
type Turn = {
  id: string;
  prompt: string;
  images: string[];
  createdAt: number;
  generationDurationMs?: number;
  modelId?: string;
  modelName?: string;
  ratioName?: string;
  size?: string;
  resolution?: string;
  count?: number;
  attachments?: Attachment[];
  apiSource?: ApiSource;
  status?: "completed" | "failed" | "cancelled";
  error?: string;
  mode?: StudioMode;
  textEdit?: TextEditState;
};
type GenerationJob = Omit<
  Turn,
  "id" | "images" | "createdAt" | "generationDurationMs"
> & {
  queueId: string;
  apiKey: string;
  quality: string;
  submittedAt?: number;
  referencesOmitted?: boolean;
};
type SavedGenerationJob = Omit<GenerationJob, "apiKey">;
type ApiSource = "cherryin" | "bfl" | "apilio";
const pendingPreviewId = "__pending__";

const preferredModelStorageKey = (source: ApiSource) =>
  `dialogue-studio-default-model-${source}`;
const initialDefaultModels: Record<ApiSource, string> = {
  cherryin: "openai/gpt-image-2",
  bfl: "bfl/flux-2-pro-preview",
  apilio: "gpt-image-2",
};
function savedPreferredModel(source: ApiSource) {
  return typeof window === "undefined"
    ? ""
    : localStorage.getItem(preferredModelStorageKey(source)) || "";
}
function preferredModelFor(source: ApiSource, models: typeof fallbackModels) {
  const preferred = savedPreferredModel(source);
  if (models.some((item) => item.id === preferred)) return preferred;
  const initial = initialDefaultModels[source];
  return models.some((item) => item.id === initial)
    ? initial
    : models[0]?.id || "";
}

const fallbackModels = [
  {
    id: "openai/gpt-image-2",
    name: "GPT Image 2",
    note: "4K 与图片编辑首选",
    mark: "✦",
  },
  {
    id: "openai/gpt-image-1",
    name: "GPT Image 1",
    note: "稳定、通用的图像生成",
    mark: "◇",
  },
  {
    id: "google/gemini-3-pro-image-preview",
    name: "Gemini 3 Pro",
    note: "原生支持 4K",
    mark: "✧",
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    name: "Gemini 3.1 Flash",
    note: "快速生成，原生支持 4K",
    mark: "⚡",
  },
  {
    id: "qwen/qwen-image(free)",
    name: "Qwen Image",
    note: "免费图片生成通道",
    mark: "Q",
  },
];
const bflModels = [
  {
    id: "bfl/flux-2-pro-preview",
    name: "FLUX.2 Pro",
    note: "Black Forest Labs · 日常默认",
    mark: "F",
  },
  {
    id: "bfl/flux-2-max",
    name: "FLUX.2 Max",
    note: "Black Forest Labs · 最高质量",
    mark: "M",
  },
  {
    id: "bfl/flux-2-klein-4b",
    name: "FLUX.2 Klein 4B",
    note: "Black Forest Labs · 快速省 Credits",
    mark: "K",
  },
  {
    id: "bfl/flux-kontext-pro",
    name: "FLUX Kontext Pro",
    note: "Black Forest Labs · 参考图编辑",
    mark: "E",
  },
];

function isBflModel(modelId?: string) {
  return Boolean(modelId?.startsWith("bfl/"));
}
function isGptImage2(modelId?: string) {
  return Boolean(modelId && /(?:^|\/)gpt-image-2(?:-|$)/i.test(modelId));
}
function sourceForModel(modelId?: string): ApiSource {
  return isBflModel(modelId) ? "bfl" : "cherryin";
}
function modelLogo(modelId: string, modelName: string) {
  const value = `${modelId} ${modelName}`.toLowerCase();
  if (/seedream|seededit/.test(value)) return "/model-logos/jimeng.svg";
  if (/grok|xai|x\.ai/.test(value)) return "/model-logos/grok.svg";
  if (/gemini|google\//.test(value)) return "/model-logos/gemini.svg";
  if (/gpt|openai|dall[ -]?e/.test(value)) return "/model-logos/openai.svg";
  if (/qwen|通义/.test(value)) return "/model-logos/qwen.svg";
  if (/kolors|可图|快手/.test(value)) return "/model-logos/kolors.svg";
  if (/flux|black forest|bfl\//.test(value)) return "/model-logos/flux.svg";
  return "";
}
type ModelVendor = { key: string; name: string; logo: string; mark: string };
function modelVendor(modelId: string, modelName: string): ModelVendor {
  const value = `${modelId} ${modelName}`.toLowerCase();
  if (/seedream|seededit|doubao|豆包|即梦/.test(value))
    return {
      key: "jimeng",
      name: "即梦 / 字节跳动",
      logo: "/model-logos/jimeng.svg",
      mark: "即",
    };
  if (/gpt|openai|dall[ -]?e/.test(value))
    return {
      key: "openai",
      name: "OpenAI",
      logo: "/model-logos/openai.svg",
      mark: "O",
    };
  if (/flux|black forest|bfl\//.test(value))
    return {
      key: "bfl",
      name: "Black Forest Labs",
      logo: "/model-logos/flux.svg",
      mark: "F",
    };
  if (/gemini|imagen|google\//.test(value))
    return {
      key: "google",
      name: "Google",
      logo: "/model-logos/gemini.svg",
      mark: "G",
    };
  if (/grok|xai|x\.ai/.test(value))
    return {
      key: "xai",
      name: "xAI",
      logo: "/model-logos/grok.svg",
      mark: "X",
    };
  if (/qwen|通义|alibaba|aliyun/.test(value))
    return {
      key: "qwen",
      name: "阿里巴巴 / 通义",
      logo: "/model-logos/qwen.svg",
      mark: "Q",
    };
  if (/kolors|可图|kling|快手/.test(value))
    return {
      key: "kuaishou",
      name: "快手",
      logo: "/model-logos/kolors.svg",
      mark: "K",
    };
  if (/hunyuan|混元|tencent/.test(value))
    return { key: "tencent", name: "腾讯", logo: "", mark: "腾" };
  if (/midjourney/.test(value))
    return { key: "midjourney", name: "Midjourney", logo: "", mark: "M" };
  if (/stable diffusion|stability|sdxl|sd3(?:\.|-|_)/.test(value))
    return { key: "stability", name: "Stability AI", logo: "", mark: "S" };
  if (/recraft/.test(value))
    return { key: "recraft", name: "Recraft", logo: "", mark: "R" };
  if (/ideogram/.test(value))
    return { key: "ideogram", name: "Ideogram", logo: "", mark: "I" };
  if (/minimax|海螺/.test(value))
    return { key: "minimax", name: "MiniMax", logo: "", mark: "M" };
  return { key: "other", name: "其他模型", logo: "", mark: "◇" };
}
const ratios = [
  { name: "智能", value: "1024x1024", shape: "smart", ratio: [1, 1] },
  { name: "21:9", value: "1024x448", shape: "wide", ratio: [21, 9] },
  { name: "16:9", value: "1024x576", shape: "wide", ratio: [16, 9] },
  { name: "3:2", value: "1024x688", shape: "landscape", ratio: [3, 2] },
  { name: "4:3", value: "1024x768", shape: "landscape", ratio: [4, 3] },
  { name: "1:1", value: "1024x1024", shape: "square", ratio: [1, 1] },
  { name: "3:4", value: "768x1024", shape: "portrait", ratio: [3, 4] },
  { name: "2:3", value: "688x1024", shape: "portrait", ratio: [2, 3] },
  { name: "9:16", value: "576x1024", shape: "portrait", ratio: [9, 16] },
];

function outputSize(
  widthRatio: number,
  heightRatio: number,
  resolution: string,
  modelId?: string,
) {
  // GPT Image 2 caps each edge at 3840px and the whole image at 8,294,400px.
  // Fit the nominal 4K selection inside both limits while keeping the ratio.
  if (isGptImage2(modelId) && resolution === "4K") {
    const maxEdge = 3840;
    const maxPixels = 8_294_400;
    const ratio = Math.min(3, Math.max(1 / 3, widthRatio / heightRatio));
    if (ratio >= 1) {
      const width =
        Math.floor(Math.min(maxEdge, Math.sqrt(maxPixels * ratio)) / 16) * 16;
      const height = Math.floor(width / ratio / 16) * 16;
      return `${width}x${height}`;
    }
    const height =
      Math.floor(Math.min(maxEdge, Math.sqrt(maxPixels / ratio)) / 16) * 16;
    const width = Math.floor((height * ratio) / 16) * 16;
    return `${width}x${height}`;
  }
  const edge = resolution === "4K" ? 4096 : resolution === "2K" ? 2048 : 1024;
  const align = (value: number) => Math.max(16, Math.round(value / 16) * 16);
  if (widthRatio >= heightRatio)
    return `${edge}x${align((edge * heightRatio) / widthRatio)}`;
  return `${align((edge * widthRatio) / heightRatio)}x${edge}`;
}

function fixedOutputSize(
  ratioName: string,
  resolution: string,
  modelId?: string,
) {
  const selected = ratios.find((item) => item.name === ratioName) || ratios[0];
  return outputSize(selected.ratio[0], selected.ratio[1], resolution, modelId);
}

async function intelligentOutputSize(
  attachments: Attachment[],
  resolution: string,
  modelId?: string,
) {
  if (!attachments.length) return outputSize(1, 1, resolution, modelId);
  const dimensions = await imageDimensions(attachments[0].data);
  if (!dimensions) return undefined;
  return outputSize(dimensions.width, dimensions.height, resolution, modelId);
}

function imageDimensions(source: string) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

export default function Home() {
  const [studioMode, setStudioMode] = useState<StudioMode>("generate");
  const [apiKey, setApiKey] = useState("");
  const [bflApiKey, setBflApiKey] = useState("");
  const [apilioApiKey, setApilioApiKey] = useState("");
  const [apiSource, setApiSource] = useState<ApiSource>("cherryin");
  const [settingsSource, setSettingsSource] = useState<ApiSource>("cherryin");
  const [cherryModels, setCherryModels] = useState(fallbackModels);
  const [apilioModels, setApilioModels] = useState<typeof fallbackModels>([]);
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [textEditImage, setTextEditImage] = useState<Attachment | null>(null);
  const [textRegions, setTextRegions] = useState<TextRegion[]>([]);
  const [activeTextRegion, setActiveTextRegion] = useState<string | null>(null);
  const [recognizingText, setRecognizingText] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [modelOptions, setModelOptions] = useState(fallbackModels);
  const [model, setModel] = useState(fallbackModels[0].id);
  const [expandedModelVendors, setExpandedModelVendors] = useState<
    Record<ApiSource, string[]>
  >({ cherryin: [], bfl: [], apilio: [] });
  const [size, setSize] = useState(ratios[0].value);
  const [ratioName, setRatioName] = useState("智能");
  const [quality, setQuality] = useState("medium");
  const [resolution, setResolution] = useState("2K");
  const [count, setCount] = useState(1);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [partialImages, setPartialImages] = useState<string[]>([]);
  const [pending, setPending] = useState<GenerationJob | null>(null);
  const [queued, setQueued] = useState<GenerationJob[]>([]);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [panel, setPanel] = useState<
    "model" | "format" | "mentions" | "settings" | null
  >(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [recentMenu, setRecentMenu] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [preview, setPreview] = useState<{
    turnId: string;
    index: number;
  } | null>(null);
  const [referencePreview, setReferencePreview] = useState<{
    references: Attachment[];
    index: number;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const conversationEnd = useRef<HTMLDivElement>(null);
  const initialBottomPositioned = useRef(false);
  const restoredScrollTop = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pageUnloadingRef = useRef(false);
  const explicitCancelRef = useRef(false);
  const processingRef = useRef(false);
  const queueRef = useRef<GenerationJob[]>([]);
  const ocrRequestRef = useRef(0);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("dialogue-studio-scroll");
      if (saved !== null && Number.isFinite(Number(saved)))
        restoredScrollTop.current = Number(saved);
    } catch {}
    const persistScroll = () => {
      pageUnloadingRef.current = true;
      try {
        sessionStorage.setItem(
          "dialogue-studio-scroll",
          String(window.scrollY),
        );
      } catch {}
    };
    const resumePage = () => {
      pageUnloadingRef.current = false;
    };
    window.addEventListener("beforeunload", persistScroll);
    window.addEventListener("pagehide", persistScroll);
    window.addEventListener("pageshow", resumePage);
    return () => {
      window.removeEventListener("beforeunload", persistScroll);
      window.removeEventListener("pagehide", persistScroll);
      window.removeEventListener("pageshow", resumePage);
    };
  }, []);

  useEffect(() => () => { void terminateOcr(); }, []);

  useEffect(() => {
    const restoredKey = localStorage.getItem("dialogue-studio-api-key") || "";
    const restoredBflKey =
      localStorage.getItem("dialogue-studio-bfl-api-key") || "";
    const restoredApilioKey =
      localStorage.getItem("dialogue-studio-apilio-api-key") || "";
    let restoredApilioModels: typeof fallbackModels = [];
    try {
      const cached = JSON.parse(
        localStorage.getItem("dialogue-studio-apilio-models") || "[]",
      ) as typeof fallbackModels;
      if (Array.isArray(cached))
        restoredApilioModels = cached.filter((item) => item?.id && item?.name);
    } catch {}
    const savedSource = localStorage.getItem("dialogue-studio-api-source");
    const restoredSource: ApiSource =
      savedSource === "bfl" || savedSource === "apilio"
        ? savedSource
        : "cherryin";
    setApiKey(restoredKey);
    setBflApiKey(restoredBflKey);
    setApilioApiKey(restoredApilioKey);
    setApilioModels(restoredApilioModels);
    setApiSource(restoredSource);
    setSettingsSource(restoredSource);
    try {
      const savedVendors = JSON.parse(
        localStorage.getItem("dialogue-studio-expanded-model-vendors") ||
          "null",
      ) as Partial<Record<ApiSource, string[]>> | null;
      if (savedVendors)
        setExpandedModelVendors({
          cherryin: savedVendors.cherryin || [],
          bfl: savedVendors.bfl || [],
          apilio: savedVendors.apilio || [],
        });
    } catch {}
    if (restoredSource === "bfl") {
      setModelOptions(bflModels);
      setModel(preferredModelFor("bfl", bflModels));
    } else if (restoredSource === "apilio") {
      setModelOptions(restoredApilioModels);
      setModel(preferredModelFor("apilio", restoredApilioModels));
    } else {
      setModel(preferredModelFor("cherryin", fallbackModels));
    }
    void (async () => {
      let localHistory: Turn[] = [];
      try {
        localHistory = JSON.parse(
          localStorage.getItem("dialogue-studio-history") || "[]",
        ) as Turn[];
      } catch {}
      try {
        const response = await fetch("/api/history", { cache: "no-store" });
        const data = (await response.json()) as { items?: Turn[] };
        const combined = new Map<string, Turn>();
        for (const turn of [...(data.items || []), ...localHistory])
          combined.set(turn.id, turn);
        const merged = Array.from(combined.values())
          .sort((a, b) => a.createdAt - b.createdAt)
          .slice(-60);
        setTurns(persistHistory(merged));
      } catch {
        setTurns(persistHistory(localHistory));
      }
    })();
    try {
      const saved = JSON.parse(
        localStorage.getItem("dialogue-studio-work") || "null",
      ) as {
        pending?: SavedGenerationJob;
        queued?: SavedGenerationJob[];
      } | null;
      const restoredQueue = (saved?.queued || []).map((job) => ({
        ...job,
        apiKey:
          job.apiSource === "apilio"
            ? restoredApilioKey
            : isBflModel(job.modelId)
              ? restoredBflKey
              : restoredKey,
      }));
      queueRef.current = restoredQueue;
      setQueued(restoredQueue);
      const pendingKey =
        saved?.pending?.apiSource === "apilio"
          ? restoredApilioKey
          : isBflModel(saved?.pending?.modelId)
            ? restoredBflKey
            : restoredKey;
      if (saved?.pending && pendingKey) {
        window.setTimeout(
          () => void runJob({ ...saved.pending!, apiKey: pendingKey }, true),
          0,
        );
      } else if (restoredQueue.length && restoredQueue[0].apiKey) {
        const first = restoredQueue[0];
        queueRef.current = restoredQueue.slice(1);
        setQueued(queueRef.current);
        window.setTimeout(() => void runJob(first), 0);
      }
    } catch {
      clearSavedWork();
    }
  }, []);
  useEffect(() => {
    if (apiSource === "bfl") {
      setModelOptions(bflModels);
      if (!bflModels.some((item) => item.id === model))
        setModel(preferredModelFor("bfl", bflModels));
      if (resolution === "4K") setResolution("2K");
      return;
    }
    const providerModels = apiSource === "apilio" ? apilioModels : cherryModels;
    const providerKey = apiSource === "apilio" ? apilioApiKey : apiKey;
    setModelOptions(providerModels);
    if (!providerModels.some((item) => item.id === model))
      setModel(preferredModelFor(apiSource, providerModels));
    if (!providerKey.trim()) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: providerKey, apiSource }),
        });
        const data = (await response.json()) as {
          models?: typeof fallbackModels;
        };
        if (response.ok && data.models?.length) {
          if (apiSource === "apilio") setApilioModels(data.models);
          else setCherryModels(data.models);
          if (apiSource === "apilio") {
            try {
              localStorage.setItem(
                "dialogue-studio-apilio-models",
                JSON.stringify(data.models),
              );
            } catch {}
          }
          setModelOptions(data.models);
          if (!data.models.some((item) => item.id === model))
            setModel(preferredModelFor(apiSource, data.models));
        }
      } catch {}
    }, 450);
    return () => window.clearTimeout(timer);
  }, [apiKey, apilioApiKey, apiSource]);
  useEffect(() => {
    if (!panel) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-floating-panel]")) return;
      setPanel(null);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [panel]);
  useEffect(() => {
    if (!actionMenu) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest("[data-result-menu]"))
        setActionMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [actionMenu]);
  useEffect(() => {
    if (!recentMenu) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest("[data-recent-menu]"))
        setRecentMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRecentMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [recentMenu]);
  useEffect(() => {
    if (!preview) return;
    const navigate = (direction: number) => {
      setPreview((current) => {
        if (!current) return null;
        const images =
          current.turnId === pendingPreviewId
            ? partialImages
            : turns.find((item) => item.id === current.turnId)?.images;
        if (!images?.length) return null;
        return {
          ...current,
          index: (current.index + direction + images.length) % images.length,
        };
      });
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
      if (event.key === "ArrowLeft") navigate(-1);
      if (event.key === "ArrowRight") navigate(1);
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [preview, turns, partialImages]);
  useEffect(() => {
    if (!referencePreview) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReferencePreview(null);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        setReferencePreview((current) =>
          current
            ? {
                ...current,
                index:
                  (current.index + direction + current.references.length) %
                  current.references.length,
              }
            : null,
        );
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [referencePreview]);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(
      () =>
        setProgress((value) =>
          Math.min(92, value + (value < 40 ? 4 : value < 75 ? 2 : 1)),
        ),
      900,
    );
    return () => window.clearInterval(timer);
  }, [busy]);
  useLayoutEffect(() => {
    if (!turns.length && !busy) return;
    const saved = restoredScrollTop.current;
    if (saved !== null) {
      restoredScrollTop.current = null;
      window.scrollTo({ top: saved, behavior: "auto" });
      return;
    }
    conversationEnd.current?.scrollIntoView({
      behavior: initialBottomPositioned.current ? "smooth" : "auto",
      block: "end",
    });
    initialBottomPositioned.current = true;
  }, [turns.length, busy, queued.length]);

  const activeModel = modelOptions.find((item) => item.id === model) ||
    modelOptions[0] || {
      id: "",
      name: "请选择模型",
      note: "填写 API Key 后读取模型",
      mark: "◇",
    };
  const modelGroups = Array.from(
    modelOptions
      .reduce((groups, item) => {
        const vendor = modelVendor(item.id, item.name);
        const current = groups.get(vendor.key);
        if (current) current.models.push(item);
        else groups.set(vendor.key, { vendor, models: [item] });
        return groups;
      }, new Map<string, { vendor: ModelVendor; models: typeof modelOptions }>())
      .values(),
  );
  const previewTurn: Turn | null | undefined =
    preview?.turnId === pendingPreviewId && pending
      ? {
          ...pending,
          id: pendingPreviewId,
          images: partialImages,
          createdAt: pending.submittedAt || 0,
        }
      : preview
        ? turns.find((item) => item.id === preview.turnId)
        : null;
  const latestTurns = [...turns].reverse().slice(0, 8);
  function saveKey(value: string) {
    setApiKey(value);
    localStorage.setItem("dialogue-studio-api-key", value);
  }
  function saveBflKey(value: string) {
    setBflApiKey(value);
    localStorage.setItem("dialogue-studio-bfl-api-key", value);
  }
  function saveApilioKey(value: string) {
    setApilioApiKey(value);
    localStorage.setItem("dialogue-studio-apilio-api-key", value);
  }
  function selectApiSource(source: ApiSource) {
    setApiSource(source);
    setSettingsSource(source);
    localStorage.setItem("dialogue-studio-api-source", source);
    const nextModels =
      source === "bfl"
        ? bflModels
        : source === "apilio"
          ? apilioModels
          : cherryModels;
    setModelOptions(nextModels);
    setModel(preferredModelFor(source, nextModels));
    if (source === "bfl" && resolution === "4K") setResolution("2K");
  }
  function selectDefaultModel(modelId: string) {
    setModel(modelId);
    localStorage.setItem(preferredModelStorageKey(apiSource), modelId);
    if (isBflModel(modelId) && resolution === "4K") setResolution("2K");
    setPanel(null);
  }
  function saveExpandedModelVendors(next: Record<ApiSource, string[]>) {
    setExpandedModelVendors(next);
    localStorage.setItem(
      "dialogue-studio-expanded-model-vendors",
      JSON.stringify(next),
    );
  }
  function openModelPanel() {
    if (panel === "model") {
      setPanel(null);
      return;
    }
    const selectedVendor = activeModel.id
      ? modelVendor(activeModel.id, activeModel.name).key
      : modelGroups[0]?.vendor.key;
    if (
      selectedVendor &&
      !expandedModelVendors[apiSource].includes(selectedVendor)
    ) {
      saveExpandedModelVendors({
        ...expandedModelVendors,
        [apiSource]: [...expandedModelVendors[apiSource], selectedVendor],
      });
    }
    setPanel("model");
  }
  function toggleModelVendor(vendorKey: string) {
    const sourceVendors = expandedModelVendors[apiSource];
    const nextSourceVendors = sourceVendors.includes(vendorKey)
      ? sourceVendors.filter((key) => key !== vendorKey)
      : [...sourceVendors, vendorKey];
    saveExpandedModelVendors({
      ...expandedModelVendors,
      [apiSource]: nextSourceVendors,
    });
  }
  function insertTextQuotes() {
    const input = promptInput.current;
    const start = input?.selectionStart ?? prompt.length;
    const end = input?.selectionEnd ?? start;
    const selected = prompt.slice(start, end);
    const next = `${prompt.slice(0, start)}“${selected}”${prompt.slice(end)}`;
    setPrompt(next);
    window.requestAnimationFrame(() => {
      if (!input) return;
      const caretStart = start + 1;
      const caretEnd = selected ? caretStart + selected.length : caretStart;
      input.focus();
      input.setSelectionRange(caretStart, caretEnd);
    });
  }
  function insertReferenceMention(index: number) {
    const input = promptInput.current;
    const start = input?.selectionStart ?? prompt.length;
    const end = input?.selectionEnd ?? start;
    const mention = `@图${index + 1} `;
    const replaceStart =
      start > 0 && prompt.charAt(start - 1) === "@" ? start - 1 : start;
    const next = `${prompt.slice(0, replaceStart)}${mention}${prompt.slice(end)}`;
    setPrompt(next);
    setPanel(null);
    window.requestAnimationFrame(() => {
      if (!input) return;
      const caret = replaceStart + mention.length;
      input.focus();
      input.setSelectionRange(caret, caret);
    });
  }
  function changePrompt(value: string, caret: number | null) {
    setPrompt(value);
    if (caret !== null && value.charAt(caret - 1) === "@") setPanel("mentions");
  }
  function openProviderBalance(source: ApiSource) {
    const urls: Record<ApiSource, string> = {
      cherryin: "https://open.cherryin.net/console",
      bfl: "https://dashboard.bfl.ai",
      apilio: "https://api.apilio.ai/topup",
    };
    window.open(urls[source], "_blank", "noopener,noreferrer");
  }
  function newChat() {
    setPrompt("");
    setAttachments([]);
    setTextEditImage(null);
    setTextRegions([]);
    setActiveTextRegion(null);
    ocrRequestRef.current += 1;
    setRecognizingText(false);
    setOcrProgress(0);
    setError("");
    setPanel(null);
  }

  function resetTextEditDraft() {
    ocrRequestRef.current += 1;
    setTextEditImage(null);
    setTextRegions([]);
    setActiveTextRegion(null);
    setRecognizingText(false);
    setOcrProgress(0);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  function switchStudioMode(next: StudioMode) {
    setStudioMode(next);
    setPanel(null);
    setError("");
    if (next === "text-edit" && apiSource === "bfl") {
      const nextSource: ApiSource = apilioApiKey.trim() ? "apilio" : "cherryin";
      setApiSource(nextSource);
      const options = nextSource === "apilio" ? apilioModels : cherryModels;
      setModelOptions(options);
      setModel(initialDefaultModels[nextSource]);
    } else if (next === "text-edit" && !isGptImage2(model)) {
      setModel(initialDefaultModels[apiSource]);
    }
  }

  async function setTextEditSource(file: File) {
    const requestId = ocrRequestRef.current + 1;
    ocrRequestRef.current = requestId;
    const image = { name: file.name, data: await readFile(file) };
    if (ocrRequestRef.current !== requestId) return;
    setTextEditImage(image);
    setTextRegions([]);
    setActiveTextRegion(null);
    setRecognizingText(true);
    setOcrProgress(0);
    setError("");
    try {
      const regions = await recognizeImageText(image.data, setOcrProgress);
      if (ocrRequestRef.current !== requestId) return;
      setTextRegions(regions);
      setActiveTextRegion(regions[0]?.id || null);
      if (!regions.length)
        setError("没有识别到文字，请在图片上拖动，手动框选要修改的位置。");
    } catch (ocrError) {
      if (ocrRequestRef.current !== requestId) return;
      setError(ocrError instanceof Error ? `文字识别失败：${ocrError.message}` : "文字识别失败，请手动框选文字区域。");
    } finally {
      if (ocrRequestRef.current === requestId) setRecognizingText(false);
    }
  }
  function deleteTurn(id: string) {
    setTurns((current) => {
      const next = current.filter((turn) => turn.id !== id);
      return persistHistory(next);
    });
    setActionMenu(null);
    setRecentMenu(null);
  }
  function clearHistory() {
    setTurns([]);
    persistHistory([]);
    setClearConfirm(false);
    setRecentMenu(null);
  }
  async function addFiles(incoming: File[]) {
    if (studioMode === "text-edit") {
      const file = incoming.find((item) => item.type.startsWith("image/"));
      if (!file) {
        setError("请拖入 PNG、JPEG 或 WebP 图片");
        return;
      }
      await setTextEditSource(file);
      return;
    }
    const files = incoming
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 5 - attachments.length);
    if (!files.length) {
      setError(
        attachments.length >= 5
          ? "最多上传 5 张参考图"
          : "请拖入 PNG、JPEG 或 WebP 图片",
      );
      return;
    }
    const next = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        data: await readFile(file),
      })),
    );
    setAttachments((current) => [...current, ...next].slice(0, 5));
    setError("");
  }
  async function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    await addFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }
  async function pasteImages(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const clipboardFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item, index) => {
        const file = item.getAsFile();
        if (!file) return null;
        const extension =
          file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
        return new File(
          [file],
          file.name || `粘贴图片-${Date.now()}-${index + 1}.${extension}`,
          { type: file.type },
        );
      })
      .filter((file): file is File => Boolean(file));
    if (clipboardFiles.length) {
      event.preventDefault();
      await addFiles(clipboardFiles);
      return;
    }

    const html = event.clipboardData.getData("text/html");
    if (!html) return;
    const source = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("img")?.src;
    if (
      !source ||
      !(
        source.startsWith("http://") ||
        source.startsWith("https://") ||
        source.startsWith("data:image/")
      )
    )
      return;
    event.preventDefault();
    try {
      if (source.startsWith("data:image/")) {
        setAttachments((current) =>
          [...current, { name: `粘贴图片-${Date.now()}`, data: source }].slice(
            0,
            5,
          ),
        );
      } else {
        const response = await fetch("/api/import-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: source }),
        });
        if (!response.ok) throw new Error("无法读取网页图片");
        const blob = await response.blob();
        const extension =
          blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
        await addFiles([
          new File([blob], `网页图片-${Date.now()}.${extension}`, {
            type: blob.type,
          }),
        ]);
      }
      setError("");
    } catch {
      setError("这个网页限制了图片复制，请先将图片存到本地后再拖入画室。");
    }
  }
  async function send(repeat?: Turn) {
    const isTextEdit = repeat?.mode === "text-edit" || (!repeat && studioMode === "text-edit");
    const textEditState = repeat?.textEdit || (textEditImage ? { sourceImage: textEditImage, regions: textRegions } : undefined);
    if (isTextEdit && !textEditState) {
      setError("请先上传需要改字的图片");
      return;
    }
    if (isTextEdit && !hasPendingReplacement(textEditState?.regions || [])) {
      setError("请至少填写一处要替换的新文字");
      return;
    }
    const runPrompt = isTextEdit
      ? buildTextEditPrompt(textEditState?.regions || [])
      : repeat?.prompt || prompt.trim();
    const runAttachments = isTextEdit
      ? [textEditState!.sourceImage]
      : repeat?.attachments || attachments;
    const requestedModel = repeat?.modelId || model;
    const runModel = isTextEdit && !isGptImage2(requestedModel)
      ? initialDefaultModels[apiSource === "bfl" ? "cherryin" : apiSource]
      : requestedModel;
    const runApiSource =
      repeat?.apiSource || (repeat ? sourceForModel(runModel) : apiSource);
    const runModelName = repeat?.modelName || activeModel.name;
    const runRatio = repeat?.ratioName || ratioName;
    const requestedResolution = repeat?.resolution || resolution;
    const runResolution =
      isBflModel(runModel) && requestedResolution === "4K"
        ? "2K"
        : requestedResolution;
    const runApiKey =
      runApiSource === "bfl"
        ? bflApiKey.trim()
        : runApiSource === "apilio"
          ? apilioApiKey.trim()
          : apiKey.trim();
    if (!runApiKey) {
      setSettingsSource(runApiSource);
      setPanel("settings");
      setError(
        runApiSource === "bfl"
          ? "请先填写 Black Forest Labs API Key"
          : runApiSource === "apilio"
            ? "请先填写 Apilio API Key"
            : "请先填写 CherryIN API Key",
      );
      return;
    }
    if (!runModel) {
      setPanel("model");
      setError("当前 API 尚未读取到可用图片模型");
      return;
    }
    // Resolution is not just display metadata: turn it into the actual pixel size
    // sent to CherryIN. Recompute old repeated turns too, because older records
    // stored a 1024-based size even when their label said 2K.
    const runSize =
      runRatio === "智能"
        ? await intelligentOutputSize(runAttachments, runResolution, runModel)
        : fixedOutputSize(runRatio, runResolution, runModel);
    const runCount = isTextEdit ? 1 : repeat?.count || count;
    if (!runPrompt) {
      setError("请输入创作内容");
      return;
    }
    if (
      repeat &&
      !runAttachments.length &&
      (/@图\d/.test(runPrompt) || /edit/i.test(runModel))
    ) {
      setError(
        "这条旧记录没有保存参考图，请重新上传参考图后再生成。新记录将自动保存参考图。",
      );
      return;
    }
    const job: GenerationJob = {
      queueId: crypto.randomUUID(),
      apiKey: runApiKey,
      apiSource: runApiSource,
      quality,
      prompt: runPrompt,
      modelId: runModel,
      modelName: runModelName,
      ratioName: runRatio,
      size: runSize,
      resolution: runResolution,
      count: runCount,
      attachments: runAttachments,
      submittedAt: Date.now(),
      mode: isTextEdit ? "text-edit" : "generate",
      textEdit: isTextEdit ? textEditState : undefined,
    };
    setError("");
    setPanel(null);
    if (!repeat) {
      if (studioMode === "generate") {
        setPrompt("");
        setAttachments([]);
      }
    }
    if (processingRef.current) {
      queueRef.current = [...queueRef.current, job];
      setQueued(queueRef.current);
      persistWork(pending, queueRef.current);
      return;
    }
    await runJob(job);
  }
  async function runJob(job: GenerationJob, resume = false) {
    const submittedAt = job.submittedAt || Date.now();
    explicitCancelRef.current = false;
    processingRef.current = true;
    setBusy(true);
    setProgress(6);
    setPartialImages([]);
    setPending(job);
    persistWork(job, queueRef.current);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (!resume && job.referencesOmitted)
        throw new Error(
          "排队任务的参考图未保存在浏览器中，请重新上传参考图后再生成。",
        );
      if (!resume) await createServerJob(job, controller.signal);
      const showPartialImages = (images: string[]) =>
        setPartialImages((current) =>
          current.length === images.length &&
          current.every((image, index) => image === images[index])
            ? current
            : images,
        );
      const data = await waitForServerJob(
        job.queueId,
        controller.signal,
        showPartialImages,
      );
      if (resume && data.missing)
        throw new Error(
          "任务状态已丢失，未自动重新生成以避免重复扣费。",
        );
      if (data.error) throw new Error(data.error);
      const completedCount = data.images?.length || 0;
      const turn: Turn = {
        id: crypto.randomUUID(),
        prompt: job.prompt || "",
        images: data.images || [],
        createdAt: submittedAt,
        generationDurationMs: Date.now() - submittedAt,
        apiSource: job.apiSource || sourceForModel(job.modelId),
        modelId: job.modelId,
        modelName: job.modelName,
        ratioName: job.ratioName,
        size: job.size,
        resolution: job.resolution,
        count: completedCount,
        attachments: data.references || job.attachments,
        mode: job.mode,
        textEdit: job.textEdit ? {
          ...job.textEdit,
          sourceImage: data.references?.[0] || job.textEdit.sourceImage,
        } : undefined,
      };
      setTurns((current) => persistHistory([...current, turn]));
      if (completedCount < (job.count || 1))
        setError(
          `请求 ${job.count || 1} 张，实际成功 ${completedCount} 张。已保留成功结果，未自动重试以避免重复扣费。`,
        );
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      const termination = decideJobTermination({
        pageUnloading: pageUnloadingRef.current,
        aborted,
        explicitCancel: explicitCancelRef.current,
      });
      if (termination.preserveWork) return;
      const message = e instanceof Error ? e.message : "生成失败";
      if (!termination.recordCancelled) setError(message);
      const failedTurn: Turn = {
        id: crypto.randomUUID(),
        prompt: job.prompt || "",
        images: [],
        createdAt: submittedAt,
        generationDurationMs: Date.now() - submittedAt,
        apiSource: job.apiSource || sourceForModel(job.modelId),
        modelId: job.modelId,
        modelName: job.modelName,
        ratioName: job.ratioName,
        size: job.size,
        resolution: job.resolution,
        count: job.count || 1,
        attachments: job.attachments,
        mode: job.mode,
        textEdit: job.textEdit,
        status: termination.recordCancelled ? "cancelled" : "failed",
        error: termination.recordCancelled ? undefined : message,
      };
      setTurns((current) => persistHistory([...current, failedTurn]));
    } finally {
      if (pageUnloadingRef.current) {
        persistWork(job, queueRef.current);
        return;
      }
      setBusy(false);
      setProgress(0);
      setPartialImages([]);
      setPending(null);
      setPreview((current) =>
        current?.turnId === pendingPreviewId ? null : current,
      );
      abortRef.current = null;
      processingRef.current = false;
      const next = queueRef.current[0];
      if (next) {
        queueRef.current = queueRef.current.slice(1);
        setQueued(queueRef.current);
        persistWork(next, queueRef.current);
        window.setTimeout(() => void runJob(next), 0);
      } else clearSavedWork();
    }
  }
  function keyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  const composer = (
    <div
      className={dragActive ? "prompt-card dragging-files" : "prompt-card"}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        void addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {dragActive && (
        <div className="drop-overlay">
          <strong>{studioMode === "text-edit" ? "松开即可识别文字" : "松开即可批量上传"}</strong>
          <span>{studioMode === "text-edit" ? "支持 PNG、JPEG、WebP · 每次 1 张" : "支持 PNG、JPEG、WebP · 最多 5 张"}</span>
        </div>
      )}
      <div className="prompt-top">
        <button
          className={
            (studioMode === "text-edit" ? textEditImage : attachments.length)
              ? "upload-tile has-image"
              : "upload-tile"
          }
          onClick={() => fileInput.current?.click()}
        >
          {studioMode === "text-edit" && textEditImage ? (
            <>
              <span className="upload-stack">
                <img src={textEditImage.data} alt={textEditImage.name} />
              </span>
              <b>↻</b>
            </>
          ) : studioMode === "generate" && attachments[0] ? (
            <>
              <span className="upload-stack">
                {attachments.slice(0, 3).map((item, index) => (
                  <img
                    key={`${item.name}-${index}`}
                    src={item.data}
                    alt={item.name}
                  />
                ))}
              </span>
              <b>＋</b>
            </>
          ) : (
            "＋"
          )}
        </button>
        {studioMode === "generate" ? (
          <textarea
            ref={promptInput}
            value={prompt}
            onChange={(e) =>
              changePrompt(e.target.value, e.currentTarget.selectionStart)
            }
            onKeyDown={keyDown}
            onPaste={(event) => void pasteImages(event)}
            placeholder="上传参考图、输入文字，描述你想生成的图片。"
            rows={3}
          />
        ) : (
          <div className="text-edit-intro">
            <strong>{textEditImage ? "选择图片中的文字" : "上传一张需要改字的图片"}</strong>
            <span>{textEditImage ? "识别在本机完成。点击文字框后，只需填写改成什么。" : "程序会在本机识别文字，不消耗 Image 2 额度。"}</span>
          </div>
        )}
      </div>
      {studioMode === "generate" && !!attachments.length && (
        <div className="attachments">
          {attachments.map((item, index) => (
            <div className="attachment-chip" key={`${item.name}-${index}`}>
              <button
                className="attachment-name"
                type="button"
                onClick={() => insertReferenceMention(index)}
              >
                <img src={item.data} alt="" />
                <span>
                  <b>@图{index + 1}</b>
                  {item.name}
                </span>
              </button>
              <div className="attachment-preview">
                <strong>{item.name}</strong>
                <img src={item.data} alt={item.name} />
              </div>
              <button
                className="attachment-remove"
                aria-label={`移除 ${item.name}`}
                onClick={() =>
                  setAttachments((items) => items.filter((_, i) => i !== index))
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {studioMode === "text-edit" && textEditImage && (
        <TextEditWorkspace
          image={textEditImage}
          regions={textRegions}
          activeId={activeTextRegion}
          recognizing={recognizingText}
          progress={ocrProgress}
          onBack={resetTextEditDraft}
          onActiveChange={setActiveTextRegion}
          onRegionsChange={setTextRegions}
        />
      )}
      <div className="prompt-tools">
        <button
          className={studioMode === "generate" ? "tool active" : "tool"}
          onClick={() => switchStudioMode("generate")}
        >
          图片生成
        </button>
        <button
          className={studioMode === "text-edit" ? "tool active" : "tool"}
          onClick={() => switchStudioMode("text-edit")}
        >
          图片改字
        </button>
        <div className="popover-anchor" data-floating-panel>
          <button
            className={panel === "model" ? "tool selected" : "tool"}
            onClick={openModelPanel}
          >
            {activeModel.name}
          </button>
          {panel === "model" && (
            <div className="popover model-popover">
              <p>
                选择默认模型{" "}
                <small>
                  {apiSource === "bfl"
                    ? "Black Forest Labs"
                    : apiSource === "apilio"
                      ? "Apilio"
                      : "CherryIN"}
                </small>
              </p>
              {modelOptions.length ? (
                modelGroups.map(({ vendor, models }) => {
                  const expanded = expandedModelVendors[apiSource].includes(
                    vendor.key,
                  );
                  return (
                    <section className="model-vendor-group" key={vendor.key}>
                      <button
                        className="model-vendor-toggle"
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => toggleModelVendor(vendor.key)}
                      >
                        <b className={vendor.logo ? "has-logo" : ""}>
                          {vendor.logo ? (
                            <img src={vendor.logo} alt="" />
                          ) : (
                            vendor.mark
                          )}
                        </b>
                        <span>
                          <strong>{vendor.name}</strong>
                          <small>{models.length} 个模型</small>
                        </span>
                        <i className={expanded ? "expanded" : ""}>⌄</i>
                      </button>
                      {expanded && (
                        <div className="model-vendor-models">
                          {models.map((item) => {
                            const logo = modelLogo(item.id, item.name);
                            return (
                              <button
                                key={item.id}
                                className={
                                  model === item.id
                                    ? "model-option chosen"
                                    : "model-option"
                                }
                                onClick={() => selectDefaultModel(item.id)}
                              >
                                <b className={logo ? "has-logo" : ""}>
                                  {logo ? <img src={logo} alt="" /> : item.mark}
                                </b>
                                <span>
                                  <strong>{item.name}</strong>
                                  <small>{item.note}</small>
                                </span>
                                {model === item.id && <em>✓</em>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })
              ) : (
                <div className="model-empty">
                  {(apiSource === "apilio"
                    ? apilioApiKey
                    : apiSource === "bfl"
                      ? bflApiKey
                      : apiKey
                  ).trim()
                    ? "正在读取模型列表…"
                    : "请先在设置中填写该来源的 API Key"}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="popover-anchor" data-floating-panel>
          <button
            className={panel === "format" ? "tool selected" : "tool"}
            onClick={() => setPanel(panel === "format" ? null : "format")}
          >
            {ratioName} <span>|</span> {resolution} <span>|</span> {studioMode === "text-edit" ? 1 : count}
          </button>
          {panel === "format" && (
            <div className="popover format-popover">
              <p>选择比例</p>
              <div className="ratio-grid">
                {ratios.map((item) => (
                  <button
                    key={`${item.name}-${item.value}`}
                    className={ratioName === item.name ? "chosen" : ""}
                    onClick={() => {
                      setRatioName(item.name);
                      setSize(item.value);
                    }}
                  >
                    <i className={item.shape} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
              <p>选择分辨率</p>
              <div className="segments">
                {["1K", "2K", "4K"].map((value) => (
                  <button
                    key={value}
                    disabled={value === "4K" && isBflModel(model)}
                    title={
                      value === "4K" && isBflModel(model)
                        ? "BFL 官方 API 最高约 4MP，画室使用 2K 档"
                        : undefined
                    }
                    className={resolution === value ? "chosen" : ""}
                    onClick={() => setResolution(value)}
                  >
                    {value === "1K" ? "标清" : value === "2K" ? "高清" : "超清"}{" "}
                    {value}
                  </button>
                ))}
              </div>
              <div className="compact-options">
                <div>
                  <p>生成质量</p>
                  <div className="segments quality-segments">
                    <button
                      className={quality === "medium" ? "chosen" : ""}
                      onClick={() => setQuality("medium")}
                    >
                      标准
                    </button>
                    <button
                      className={quality === "high" ? "chosen" : ""}
                      onClick={() => setQuality("high")}
                    >
                      高质量
                    </button>
                  </div>
                </div>
                <div className={studioMode === "text-edit" ? "mode-hidden" : ""}>
                  <p>生成数量</p>
                  <div className="segments counts">
                    {[1, 2, 3, 4].map((value) => (
                      <button
                        key={value}
                        className={count === value ? "chosen" : ""}
                        onClick={() => setCount(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className={studioMode === "text-edit" ? "tooltip-anchor mode-hidden" : "tooltip-anchor"}>
          <button
            className="tool icon-tool"
            aria-label="文字效果增强"
            onClick={insertTextQuotes}
          >
            T‚
          </button>
          <span className="tool-tooltip">文字效果增强</span>
        </div>
        <div className={studioMode === "text-edit" ? "popover-anchor mode-hidden" : "popover-anchor"} data-floating-panel>
          <button
            className={
              panel === "mentions"
                ? "tool icon-tool selected"
                : "tool icon-tool"
            }
            aria-label="引用已上传图片"
            onClick={() => setPanel(panel === "mentions" ? null : "mentions")}
          >
            @
          </button>
          {panel === "mentions" && (
            <div className="popover mention-popover">
              <p>可引用的图片</p>
              {attachments.length ? (
                <div className="mention-grid">
                  {attachments.map((item, index) => (
                    <button
                      key={`${item.name}-${index}`}
                      onClick={() => insertReferenceMention(index)}
                    >
                      <img src={item.data} alt={item.name} />
                      <span>
                        <strong>@图{index + 1}</strong>
                        <small>{item.name}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mention-empty">
                  <div className="empty-stack">
                    <i>↑</i>
                    <i>↑</i>
                    <i>↑</i>
                  </div>
                  <strong>还没有上传图片</strong>
                  <small>上传参考图后，可在指令中通过 @ 精确引用</small>
                  <button onClick={() => fileInput.current?.click()}>
                    ＋ 上传图片
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <span className="tool-spacer" />
        {queued.length > 0 && (
          <span className="queue-count">排队 {queued.length}</span>
        )}
        <button
          className="send"
          disabled={studioMode === "text-edit" && (recognizingText || !textEditImage || !hasPendingReplacement(textRegions))}
          aria-label={busy ? "加入生成队列" : studioMode === "text-edit" ? "开始改字" : "开始生成"}
          onClick={() => void send()}
        >
          <span aria-hidden>↑</span>
        </button>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <input
        ref={fileInput}
        hidden
        multiple={studioMode === "generate"}
        accept="image/png,image/jpeg,image/webp"
        type="file"
        onChange={chooseFiles}
      />
    </div>
  );

  return (
    <main className={sidebarOpen ? "app-shell" : "app-shell sidebar-closed"}>
      <aside className="sidebar">
        <div className="side-head">
          <strong>开启创作</strong>
          <button onClick={() => setSidebarOpen(false)}>◧</button>
        </div>
        <button className="new-chat" onClick={newChat}>
          <b>✎</b>新对话
        </button>
        <div className="default-item">
          <span>
            <img src="/xie-studio-logo.png" alt="" />
          </span>
          谢师傅工作室
        </div>
        <div className="recent-heading">
          <p className="recent-label">最近</p>
          {latestTurns.length > 0 && (
            <button onClick={() => setClearConfirm(true)}>清空</button>
          )}
        </div>
        <nav>
          {latestTurns.map((turn) => (
            <div className="recent-item" key={turn.id}>
              <button
                className="recent-main"
                onClick={() => {
                  setPrompt(turn.prompt);
                  document
                    .getElementById(`turn-${turn.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {turn.images[0] ? (
                  <img src={turn.images[0]} alt="" />
                ) : (
                  <i>✦</i>
                )}
                <span>{turn.prompt}</span>
              </button>
              <div className="recent-menu-anchor" data-recent-menu>
                <button
                  className="recent-more"
                  aria-label="记录操作"
                  onClick={() =>
                    setRecentMenu(recentMenu === turn.id ? null : turn.id)
                  }
                >
                  •••
                </button>
                {recentMenu === turn.id && (
                  <div className="recent-menu">
                    <button onClick={() => deleteTurn(turn.id)}>
                      删除该批次结果
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </nav>
        <button
          className="settings-button"
          data-floating-panel
          onClick={() => {
            if (panel !== "settings") setSettingsSource(apiSource);
            setPanel(panel === "settings" ? null : "settings");
          }}
        >
          ⚙ 设置
        </button>
        {panel === "settings" && (
          <div className="settings-popover" data-floating-panel>
            <div>
              <strong>模型 API 设置</strong>
              <button onClick={() => setPanel(null)}>×</button>
            </div>
            <div
              className="api-source-switch"
              role="group"
              aria-label="API 来源"
            >
              <button
                className={settingsSource === "cherryin" ? "chosen" : ""}
                onClick={() => selectApiSource("cherryin")}
              >
                <b>CherryIN</b>
                <small>聚合模型</small>
              </button>
              <button
                className={settingsSource === "bfl" ? "chosen" : ""}
                onClick={() => selectApiSource("bfl")}
              >
                <b>Black Forest</b>
                <small>FLUX 官方</small>
              </button>
              <button
                className={settingsSource === "apilio" ? "chosen" : ""}
                onClick={() => selectApiSource("apilio")}
              >
                <b>Apilio</b>
                <small>聚合模型</small>
              </button>
            </div>
            {settingsSource === "cherryin" ? (
              <>
                <label>
                  CherryIN API Key
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => saveKey(e.target.value)}
                    placeholder="sk-••••••••"
                  />
                </label>
                <BalanceLink
                  label="CherryIN 账户余额"
                  onClick={() => openProviderBalance("cherryin")}
                />
              </>
            ) : settingsSource === "bfl" ? (
              <>
                <label>
                  Black Forest Labs API Key
                  <input
                    type="password"
                    value={bflApiKey}
                    onChange={(e) => saveBflKey(e.target.value)}
                    placeholder="BFL API Key"
                  />
                </label>
                <BalanceLink
                  label="Black Forest Credits"
                  onClick={() => openProviderBalance("bfl")}
                />
              </>
            ) : (
              <>
                <label>
                  Apilio API Key
                  <input
                    type="password"
                    value={apilioApiKey}
                    onChange={(e) => saveApilioKey(e.target.value)}
                    placeholder="sk-••••••••"
                  />
                </label>
                <BalanceLink
                  label="Apilio 钱包余额"
                  onClick={() => openProviderBalance("apilio")}
                />
              </>
            )}
          </div>
        )}
      </aside>
      {!sidebarOpen && (
        <button className="open-sidebar" onClick={() => setSidebarOpen(true)}>
          ☰
        </button>
      )}
      <section className="stage">
        {turns.length || busy || queued.length ? (
          <div className="conversation">
            {turns.map((turn) => (
              <article
                className="generation-entry"
                id={`turn-${turn.id}`}
                key={turn.id}
              >
                <GenerationHeader
                  turn={turn}
                  onReferenceClick={(references) =>
                    setReferencePreview({ references, index: 0 })
                  }
                />
                {turn.status === "failed" || turn.status === "cancelled" ? (
                  <div
                    className={
                      turn.status === "cancelled"
                        ? "failed-state cancelled-state"
                        : "failed-state"
                    }
                  >
                    <strong>
                      {turn.status === "cancelled" ? "已取消" : "生成失败"}
                    </strong>
                    {turn.error && <span>{turn.error}</span>}
                  </div>
                ) : (
                  <div className="result-grid">
                    {turn.images.map((image, index) => (
                      <GeneratedResult
                        key={index}
                        src={image}
                        alt={`生成结果 ${index + 1}`}
                        downloadName={`cherryin-${turn.createdAt}-${index + 1}.png`}
                        onOpen={() => setPreview({ turnId: turn.id, index })}
                      />
                    ))}
                  </div>
                )}
                <div className="result-actions">
                  <button
                    onClick={() => {
                      if (turn.mode === "text-edit" && turn.textEdit) {
                        const sourceImage = turn.images[0]
                          ? { name: `继续修改-${turn.textEdit.sourceImage.name}`, data: turn.images[0] }
                          : turn.textEdit.sourceImage;
                        setStudioMode("text-edit");
                        setTextEditImage(sourceImage);
                        setTextRegions(turn.textEdit.regions.map((region) => ({
                          ...region,
                          text: region.replacement.trim() || region.text,
                          replacement: "",
                        })));
                        setActiveTextRegion(turn.textEdit.regions[0]?.id || null);
                        setError("");
                        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                        return;
                      }
                      setPrompt(turn.prompt);
                      setAttachments(turn.attachments || []);
                      promptInput.current?.focus();
                    }}
                  >
                    {turn.mode === "text-edit" ? "继续改字" : "重新编辑"}
                  </button>
                  <button onClick={() => void send(turn)}>再次生成</button>
                  <div className="result-menu-anchor" data-result-menu>
                    <button
                      onClick={() =>
                        setActionMenu(actionMenu === turn.id ? null : turn.id)
                      }
                    >
                      •••
                    </button>
                    {actionMenu === turn.id && (
                      <div className="result-menu">
                        <button onClick={() => deleteTurn(turn.id)}>
                          <span>♙</span> 删除该批次结果
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
            {busy && pending && (
              <article className="generation-entry pending-entry">
                <GenerationHeader
                  turn={pending}
                  onReferenceClick={(references) =>
                    setReferencePreview({ references, index: 0 })
                  }
                />
                <div className="pending-grid">
                  {Array.from({ length: pending.count || 1 }, (_, index) => {
                    const image = partialImages[index];
                    return image ? (
                      <GeneratedResult
                        key={image}
                        src={image}
                        alt={`已完成结果 ${index + 1}`}
                        downloadName={`cherryin-${pending.submittedAt || 0}-${index + 1}.png`}
                        statusLabel={`${index + 1} / ${pending.count || 1} 已完成`}
                        onOpen={() =>
                          setPreview({ turnId: pendingPreviewId, index })
                        }
                      />
                    ) : (
                      <div key={index}>
                        <b>
                          {partialImages.length} / {pending.count || 1}
                          {index === partialImages.length
                            ? ` · ${progress}%`
                            : ""}
                        </b>
                        <i />
                      </div>
                    );
                  })}
                </div>
                <div className="result-actions">
                  <button
                    onClick={() => {
                      explicitCancelRef.current = true;
                      abortRef.current?.abort();
                    }}
                  >
                    停止生成
                  </button>
                </div>
              </article>
            )}
            {queued.map((job, queueIndex) => (
              <article
                className="generation-entry queued-entry"
                key={job.queueId}
              >
                <GenerationHeader
                  turn={job}
                  onReferenceClick={(references) =>
                    setReferencePreview({ references, index: 0 })
                  }
                />
                <div className="queued-status">
                  <strong>等待中</strong>
                  <span>前面还有 {queueIndex + 1} 个任务</span>
                </div>
              </article>
            ))}
            <div className="conversation-end" ref={conversationEnd} />
          </div>
        ) : (
          <div className="empty-state">
            <h1>你好，想创作什么？</h1>
            {composer}
          </div>
        )}
        {(turns.length > 0 || busy || queued.length > 0) && (
          <div className="bottom-composer">{composer}</div>
        )}
      </section>
      {preview && previewTurn && (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={() => setPreview(null)}
        >
          <div className="lightbox-bar">
            <span>
              {preview.index + 1} / {previewTurn.images.length}
            </span>
            <a
              href={previewTurn.images[preview.index]}
              download={`cherryin-${previewTurn.createdAt}-${preview.index + 1}.png`}
              onClick={(event) => event.stopPropagation()}
            >
              下载
            </a>
            <button aria-label="关闭预览" onClick={() => setPreview(null)}>
              ×
            </button>
          </div>
          {previewTurn.images.length > 1 && (
            <button
              className="lightbox-arrow previous"
              aria-label="上一张"
              onClick={(event) => {
                event.stopPropagation();
                setPreview({
                  ...preview,
                  index:
                    (preview.index - 1 + previewTurn.images.length) %
                    previewTurn.images.length,
                });
              }}
            >
              ‹
            </button>
          )}
          <img
            src={previewTurn.images[preview.index]}
            alt={`放大预览 ${preview.index + 1}`}
            onClick={(event) => event.stopPropagation()}
          />
          {previewTurn.images.length > 1 && (
            <button
              className="lightbox-arrow next"
              aria-label="下一张"
              onClick={(event) => {
                event.stopPropagation();
                setPreview({
                  ...preview,
                  index: (preview.index + 1) % previewTurn.images.length,
                });
              }}
            >
              ›
            </button>
          )}
        </div>
      )}
      {referencePreview && (
        <div
          className="image-lightbox reference-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="参考图预览"
          onClick={() => setReferencePreview(null)}
        >
          <div className="lightbox-bar">
            <span>
              参考图 {referencePreview.index + 1} /{" "}
              {referencePreview.references.length}
            </span>
            <button
              aria-label="关闭预览"
              onClick={() => setReferencePreview(null)}
            >
              ×
            </button>
          </div>
          {referencePreview.references.length > 1 && (
            <button
              className="lightbox-arrow previous"
              aria-label="上一张参考图"
              onClick={(event) => {
                event.stopPropagation();
                setReferencePreview({
                  ...referencePreview,
                  index:
                    (referencePreview.index -
                      1 +
                      referencePreview.references.length) %
                    referencePreview.references.length,
                });
              }}
            >
              ‹
            </button>
          )}
          <img
            src={referencePreview.references[referencePreview.index].data}
            alt={referencePreview.references[referencePreview.index].name}
            onClick={(event) => event.stopPropagation()}
          />
          {referencePreview.references.length > 1 && (
            <button
              className="lightbox-arrow next"
              aria-label="下一张参考图"
              onClick={(event) => {
                event.stopPropagation();
                setReferencePreview({
                  ...referencePreview,
                  index:
                    (referencePreview.index + 1) %
                    referencePreview.references.length,
                });
              }}
            >
              ›
            </button>
          )}
        </div>
      )}
      {clearConfirm && (
        <div
          className="confirm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="确认清空记录"
          onClick={() => setClearConfirm(false)}
        >
          <div
            className="confirm-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <strong>清空全部记录？</strong>
            <p>所有生成记录将从“最近”和当前页面中移除，此操作无法撤销。</p>
            <div>
              <button onClick={() => setClearConfirm(false)}>取消</button>
              <button className="danger" onClick={clearHistory}>
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function GeneratedResult({
  src,
  alt,
  downloadName,
  onOpen,
  statusLabel,
}: {
  src: string;
  alt: string;
  downloadName: string;
  onOpen: () => void;
  statusLabel?: string;
}) {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  return (
    <figure className="generated-result">
      <div className="result-image-frame" onClick={onOpen}>
        <img
          src={src}
          alt={alt}
          onLoad={(event) =>
            setDimensions({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
        />
        {statusLabel && <b className="result-status-label">{statusLabel}</b>}
        <a
          href={src}
          download={downloadName}
          onClick={(event) => event.stopPropagation()}
        >
          下载
        </a>
      </div>
      <figcaption>
        {dimensions
          ? `${dimensions.width} × ${dimensions.height} px`
          : "读取分辨率…"}
      </figcaption>
    </figure>
  );
}

function BalanceLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="balance-card">
      <span>{label}</span>
      <strong>前往官网查看</strong>
      <button onClick={onClick}>查看余额 ↗</button>
    </div>
  );
}

function GenerationHeader({
  turn,
  onReferenceClick,
}: {
  turn: Pick<
    Turn,
    | "prompt"
    | "modelId"
    | "modelName"
    | "ratioName"
    | "resolution"
    | "attachments"
    | "apiSource"
    | "generationDurationMs"
  > & { createdAt?: number };
  onReferenceClick?: (references: Attachment[]) => void;
}) {
  const references = turn.attachments || [];
  const source = turn.apiSource || sourceForModel(turn.modelId);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!detailsOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!detailsRef.current?.contains(event.target as Node))
        setDetailsOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailsOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [detailsOpen]);
  return (
    <div className="generation-header">
      {!!references.length && (
        <div
          className="generation-thumbnails"
          role="button"
          tabIndex={0}
          aria-label={`放大查看 ${references.length} 张参考图`}
          onClick={() => onReferenceClick?.(references)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ")
              onReferenceClick?.(references);
          }}
        >
          {references.slice(0, 3).map((item, index) => (
            <img
              key={`${item.name}-${index}`}
              src={item.data}
              alt={item.name}
            />
          ))}
          <span>“</span>
        </div>
      )}
      <div className="generation-description">
        <strong>{turn.prompt}</strong>
        <span>
          {turn.modelName || "图片模型"}
          <i /> {turn.ratioName || "智能比例"}
          <i /> {turn.resolution || "2K"}
          {turn.createdAt && (
            <span className="details-anchor" ref={detailsRef}>
              <i />
              <button onClick={() => setDetailsOpen((open) => !open)}>
                详细信息 ⓘ
              </button>
              {detailsOpen && (
                <div className="generation-details">
                  <span>提交时间</span>
                  <strong>{formatGenerationTime(turn.createdAt)}</strong>
                  <span>生成用时</span>
                  <strong>
                    {formatGenerationDuration(turn.generationDurationMs)}
                  </strong>
                </div>
              )}
            </span>
          )}
          <span className={`api-source-badge ${source}`}>
            {source === "bfl"
              ? "Black Forest"
              : source === "apilio"
                ? "Apilio"
                : "CherryIN"}
          </span>
        </span>
      </div>
    </div>
  );
}

function formatGenerationTime(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatGenerationDuration(duration?: number) {
  if (duration === undefined) return "未记录";
  const totalSeconds = Math.max(1, Math.round(duration / 1000));
  if (totalSeconds < 60) return `${totalSeconds} 秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分钟`;
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function persistHistory(items: Turn[]) {
  const visible = items.slice(-60);
  let storable = visible.map((turn) => ({
    ...turn,
    attachments: (turn.attachments || []).filter((item) =>
      item.data.startsWith("/generated/"),
    ),
    textEdit: turn.textEdit?.sourceImage.data.startsWith("/generated/")
      ? turn.textEdit
      : undefined,
  }));
  while (storable.length) {
    try {
      localStorage.setItem("dialogue-studio-history", JSON.stringify(storable));
      void persistServerHistory(storable);
      return visible;
    } catch {
      storable = storable.slice(1);
    }
  }
  try {
    localStorage.removeItem("dialogue-studio-history");
  } catch {}
  void persistServerHistory([]);
  return visible;
}

async function persistServerHistory(items: Turn[]) {
  try {
    await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  } catch {}
}

function persistWork(pending: GenerationJob | null, queued: GenerationJob[]) {
  if (!pending && !queued.length) return clearSavedWork();
  const withoutKey = ({
    apiKey: _apiKey,
    ...job
  }: GenerationJob): SavedGenerationJob => {
    const attachments = (job.attachments || []).filter((item) =>
      item.data.startsWith("/generated/"),
    );
    return {
      ...job,
      attachments,
      referencesOmitted: Boolean(
        job.referencesOmitted ||
        attachments.length !== (job.attachments || []).length,
      ),
    };
  };
  try {
    localStorage.setItem(
      "dialogue-studio-work",
      JSON.stringify({
        pending: pending ? withoutKey(pending) : undefined,
        queued: queued.map(withoutKey),
      }),
    );
  } catch {
    // Keep at least the server job IDs and lightweight metadata when Safari's
    // storage is nearly full, so a refresh can continue polling the jobs.
    try {
      const minimal = (job: GenerationJob) => {
        const { apiKey: _apiKey, attachments: _attachments, ...rest } = job;
        return {
          ...rest,
          attachments: [],
          referencesOmitted: Boolean(job.attachments?.length),
        };
      };
      localStorage.setItem(
        "dialogue-studio-work",
        JSON.stringify({
          pending: pending ? minimal(pending) : undefined,
          queued: queued.map(minimal),
        }),
      );
    } catch {}
  }
}

function clearSavedWork() {
  try {
    localStorage.removeItem("dialogue-studio-work");
  } catch {}
}

async function createServerJob(job: GenerationJob, signal: AbortSignal) {
  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: job.queueId,
      apiKey: job.apiKey,
      apiSource: job.apiSource,
      prompt: job.prompt,
      model: job.modelId,
      size: job.size,
      quality: job.quality,
      count: job.count,
      references: job.attachments,
    }),
    signal,
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error || "无法创建生成任务");
}

async function waitForServerJob(
  queueId: string,
  signal: AbortSignal,
  onProgress: (images: string[]) => void,
) {
  for (;;) {
    const response = await fetch(`/api/jobs/${encodeURIComponent(queueId)}`, {
      cache: "no-store",
      signal,
    });
    const data = (await response.json()) as {
      status?: "running" | "completed" | "failed";
      images?: string[];
      references?: Attachment[];
      error?: string;
      requestedCount?: number;
      completedCount?: number;
    };
    if (response.status === 404) return { missing: true, error: "" };
    if (!response.ok) throw new Error(data.error || "无法读取任务状态");
    onProgress(data.images || []);
    if (data.status === "completed") return { ...data, missing: false };
    if (data.status === "failed") throw new Error(data.error || "生成失败");
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, 1200);
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }
}
