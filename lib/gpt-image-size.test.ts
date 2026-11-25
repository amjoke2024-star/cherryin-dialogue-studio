import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGptImage2Size } from "./gpt-image-size.ts";

for (const version of ["2.5", "2.6"]) {
  test(`GPT Image ${version} Sunburst 4K keeps the portrait ratio within the API limits`, () => {
    assert.equal(
      normalizeGptImage2Size(`gpt-image-${version}-sunburst-4k`, "3072x4096"),
      "2480x3312",
    );
  });
}

test("GPT Image 2 keeps valid sizes and leaves other model families alone", () => {
  assert.equal(normalizeGptImage2Size("openai/gpt-image-2", "2160x3840"), "2160x3840");
  assert.equal(normalizeGptImage2Size("gpt-image-2.6-flare", "auto"), "auto");
  assert.equal(normalizeGptImage2Size("gemini-3-pro-image", "3072x4096"), "3072x4096");
  assert.equal(normalizeGptImage2Size("gpt-image-2.6-sunburst-4k", undefined), undefined);
});
