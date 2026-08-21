import assert from "node:assert/strict";
import test from "node:test";
import {
  apiProvider,
  apiProviderModels,
  createLatestProviderRequestGate,
  type ApiSource,
} from "./api-providers.ts";

test("GoAPI uses its OpenAI-compatible image endpoints and account page", () => {
  assert.deepEqual(apiProvider("goapi"), {
    id: "goapi",
    name: "GoAPI",
    baseURL: "https://api.goapi.ai",
    balanceURL: "https://goapi.ai/dashboard",
    keyStorageKey: "dialogue-studio-goapi-api-key",
    modelsStorageKey: "dialogue-studio-goapi-models",
    defaultModel: "gpt-image-2",
  });
});

test("GoAPI has usable image models before a remote model-list request succeeds", () => {
  assert.deepEqual(apiProviderModels("goapi"), [
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
  ]);
});

test("every supported API source resolves to provider metadata", () => {
  const sources: ApiSource[] = ["cherryin", "bfl", "apilio", "goapi"];
  assert.deepEqual(sources.map((source) => apiProvider(source).id), sources);
});

test("a late Apilio model response cannot replace the newer GoAPI selection", () => {
  const gate = createLatestProviderRequestGate();
  const apilioRequest = gate.begin("apilio");
  const goapiRequest = gate.begin("goapi");

  assert.equal(gate.isCurrent(apilioRequest), false);
  assert.equal(gate.isCurrent(goapiRequest), true);
});
