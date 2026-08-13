import assert from "node:assert/strict";
import test from "node:test";
import { decideJobTermination } from "./job-lifecycle.ts";

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
