import { modelSuffixResolution } from "./adaptive-resolution.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
  availableResolutions,
  outputResolutionForSelection,
} from "./adaptive-resolution.ts";

test("Apilio offers adaptive resolution before the fixed resolution choices", () => {
  assert.deepEqual(availableResolutions("apilio", false), [
    "自适应",
    "1K",
    "2K",
    "4K",
  ]);
  assert.deepEqual(availableResolutions("apilio", true), ["自适应", "2K", "4K"]);
});

test("other providers keep only their existing fixed resolution choices", () => {
  assert.deepEqual(availableResolutions("cherryin", false), ["1K", "2K", "4K"]);
  assert.deepEqual(availableResolutions("bfl", true), ["2K", "4K"]);
});

test("adaptive resolution follows the resolution encoded by the Apilio model", () => {
  assert.equal(
    outputResolutionForSelection("apilio", "自适应", "gpt-image-2.5-sunburst-2k"),
    "2K",
  );
  assert.equal(
    outputResolutionForSelection("apilio", "自适应", "gpt-image-2.5-sunburst-4k"),
    "4K",
  );
  assert.equal(
    outputResolutionForSelection("apilio", "自适应", "gpt-image-2.5-sunburst"),
    undefined,
  );
});

test("fixed resolution selections remain unchanged", () => {
  assert.equal(
    outputResolutionForSelection("apilio", "2K", "gpt-image-2.5-sunburst-4k"),
    "2K",
  );
  assert.equal(
    outputResolutionForSelection("cherryin", "2K", "gpt-image-2"),
    "2K",
  );
});


test("model resolution follows an explicit terminal 2K or 4K suffix", () => {
  assert.equal(modelSuffixResolution("gpt-image-2.5-sunburst-2k"), "2K");
  assert.equal(modelSuffixResolution("provider/model_4K"), "4K");
  assert.equal(modelSuffixResolution("model-4k-preview"), undefined);
  assert.equal(modelSuffixResolution("gpt-image-2"), undefined);
});
