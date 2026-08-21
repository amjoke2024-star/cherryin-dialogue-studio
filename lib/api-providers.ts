export type ApiSource = "cherryin" | "bfl" | "apilio" | "goapi";

export type StudioModel = {
  id: string;
  name: string;
  note: string;
  mark: string;
};

type ApiProvider = {
  id: ApiSource;
  name: string;
  baseURL: string;
  balanceURL: string;
  keyStorageKey: string;
  modelsStorageKey: string;
  defaultModel: string;
};

const providers: Record<ApiSource, ApiProvider> = {
  cherryin: {
    id: "cherryin",
    name: "CherryIN",
    baseURL: "https://open.cherryin.net",
    balanceURL: "https://open.cherryin.net/console",
    keyStorageKey: "dialogue-studio-api-key",
    modelsStorageKey: "",
    defaultModel: "openai/gpt-image-2",
  },
  bfl: {
    id: "bfl",
    name: "Black Forest Labs",
    baseURL: "https://api.bfl.ai",
    balanceURL: "https://dashboard.bfl.ai",
    keyStorageKey: "dialogue-studio-bfl-api-key",
    modelsStorageKey: "",
    defaultModel: "bfl/flux-2-pro-preview",
  },
  apilio: {
    id: "apilio",
    name: "Apilio",
    baseURL: "https://api.apilio.ai",
    balanceURL: "https://api.apilio.ai/topup",
    keyStorageKey: "dialogue-studio-apilio-api-key",
    modelsStorageKey: "dialogue-studio-apilio-models",
    defaultModel: "gpt-image-2",
  },
  goapi: {
    id: "goapi",
    name: "GoAPI",
    baseURL: "https://api.goapi.ai",
    balanceURL: "https://goapi.ai/dashboard",
    keyStorageKey: "dialogue-studio-goapi-api-key",
    modelsStorageKey: "dialogue-studio-goapi-models",
    defaultModel: "gpt-image-2",
  },
};

const goapiModels: StudioModel[] = [
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    note: "GoAPI · 生成与图片编辑",
    mark: "G",
  },
  {
    id: "gpt-image-2-preview",
    name: "GPT Image 2 Preview",
    note: "GoAPI · 固定按张计费",
    mark: "G",
  },
];

export function apiProvider(source: ApiSource) {
  return providers[source];
}

export function apiProviderModels(source: ApiSource): StudioModel[] {
  return source === "goapi" ? goapiModels.map((model) => ({ ...model })) : [];
}

export function createLatestProviderRequestGate() {
  let sequence = 0;
  return {
    begin(source: ApiSource) {
      sequence += 1;
      return { source, sequence };
    },
    isCurrent(request: { source: ApiSource; sequence: number }) {
      return request.sequence === sequence;
    },
  };
}
