import assert from "node:assert/strict";
import test from "node:test";
import {
  apilioPriceNote,
  type ApilioPricingCatalog,
} from "./apilio-model-pricing.ts";

const catalog: ApilioPricingCatalog = {
  models: [
    {
      key: "gpt-image-2.5-sunburst-4k",
      group_price: {
        default: { type: 1, price: 0.15, group_ratio: 1 },
      },
    },
    {
      key: "gemini-3-pro-image",
      group_price: {
        "gemini-t3": { type: 1, price: 0.2, group_ratio: 4 },
      },
    },
    {
      key: "dall-e-3",
      group_price: {
        default: { type: 1, price: 0.04, group_ratio: 1 },
      },
      ratios: { ratios: [1, 2, 3] },
    },
  ],
};

test("Apilio fixed per-generation pricing is appended with a yuan symbol", () => {
  assert.equal(
    apilioPriceNote(
      "Apilio · custom",
      "gpt-image-2.5-sunburst-4k",
      catalog,
    ),
    "¥0.15/次 · custom · Apilio",
  );
});

test("Apilio pricing follows the first group shown by its model marketplace", () => {
  assert.equal(
    apilioPriceNote("Apilio · custom", "gemini-3-pro-image", catalog),
    "¥0.8/次 · custom · Apilio",
  );
});

test("tiered Apilio pricing is marked as a starting price", () => {
  assert.equal(
    apilioPriceNote("Apilio · openai", "dall-e-3", catalog),
    "¥0.04/次起 · openai · Apilio",
  );
});

test("an unavailable or token-priced model keeps its original note", () => {
  assert.equal(
    apilioPriceNote("Apilio · custom", "unknown-image-model", catalog),
    "Apilio · custom",
  );
});
