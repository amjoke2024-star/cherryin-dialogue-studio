import assert from "node:assert/strict";
import test from "node:test";
import {
  decideJobTermination,
  generationCountForMode,
  generationTiming,
  normalizeStudioMode,
  supportsMultipleImages,
} from "./job-lifecycle.ts";

test("old jobs without a mode remain image generation jobs", () => {
  assert.equal(normalizeStudioMode(undefined), "generate");
  assert.equal(normalizeStudioMode("text-edit"), "text-edit");
  assert.equal(normalizeStudioMode("unknown"), "generate");
});

test("product blend is a persisted studio mode", () => {
  assert.equal(normalizeStudioMode("product-blend"), "product-blend");
});

test("image upscale is a persisted studio mode", () => {
  assert.equal(normalizeStudioMode("image-upscale"), "image-upscale");
});

test("product blend supports the selected image count while text edit stays single", () => {
  assert.equal(supportsMultipleImages("generate"), true);
  assert.equal(supportsMultipleImages("product-blend"), true);
  assert.equal(supportsMultipleImages("text-edit"), false);
  assert.equal(generationCountForMode("product-blend", 4), 4);
  assert.equal(generationCountForMode("generate", 3), 3);
  assert.equal(generationCountForMode("text-edit", 4), 1);
});

test("image upscale keeps the selected image count", () => {
  assert.equal(supportsMultipleImages("image-upscale"), true);
  assert.equal(generationCountForMode("image-upscale", 4), 4);
});

test("page unload preserves the active job without recording cancellation", () => {
  assert.deepEqual(
    decideJobTermination({
      pageUnloading: true,
      aborted: true,
      explicitCancel: false,
    }),
    { preserveWork: true, recordCancelled: false },
  );
});

test("explicit cancellation records cancellation and clears recoverable work", () => {
  assert.deepEqual(
    decideJobTermination({
      pageUnloading: false,
      aborted: true,
      explicitCancel: true,
    }),
    { preserveWork: false, recordCancelled: true },
  );
});

test("ordinary completion or failure does not preserve active work", () => {
  assert.deepEqual(
    decideJobTermination({
      pageUnloading: false,
      aborted: false,
      explicitCancel: false,
    }),
    { preserveWork: false, recordCancelled: false },
  );
});

test("page unload wins even before fetch reports an abort", () => {
  assert.deepEqual(
    decideJobTermination({
      pageUnloading: true,
      aborted: false,
      explicitCancel: false,
    }),
    { preserveWork: true, recordCancelled: false },
  );
});

test("generation timing separates queue wait from actual provider work", () => {
  assert.deepEqual(generationTiming(1_000, 4_000, 10_000), {
    queueWaitMs: 3_000,
    generationDurationMs: 6_000,
  });
});

test("older jobs without a server start timestamp keep their total duration", () => {
  assert.deepEqual(generationTiming(1_000, undefined, 10_000), {
    queueWaitMs: 0,
    generationDurationMs: 9_000,
  });
});
