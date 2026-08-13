# Refresh Running Job Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve and resume an in-progress image job across browser refreshes without resubmitting paid generation requests.

**Architecture:** Track whether the current page is unloading and distinguish that event from an explicit user cancellation. Centralize the terminal-state decision in a pure helper so the refresh path can be tested without a browser or paid API, then use that decision in `runJob` to retain `dialogue-studio-work` during unload and resume polling with the existing job ID.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Node.js 22 built-in test runner.

## Global Constraints

- A refresh must only resume status polling; it must never recreate or resubmit the paid generation request.
- Partial images, current job metadata, and queued-job order must remain recoverable.
- Explicit user cancellation must keep its current cancellation behavior.
- A missing server job must display a clear error and must not trigger automatic paid regeneration.
- Tests must not call a real image-generation provider.
- The project directory is not a Git repository; replace commit steps with local verification checkpoints.

---

### Task 1: Make termination decisions explicit and testable

**Files:**
- Create: `lib/job-lifecycle.ts`
- Create: `lib/job-lifecycle.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `decideJobTermination(input: { pageUnloading: boolean; aborted: boolean; explicitCancel: boolean }): { preserveWork: boolean; recordCancelled: boolean }`
- Consumes: no application state or browser APIs.

- [ ] **Step 1: Write the failing lifecycle tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { decideJobTermination } from "./job-lifecycle.ts";

test("page unload preserves the active job without recording cancellation", () => {
  assert.deepEqual(
    decideJobTermination({ pageUnloading: true, aborted: true, explicitCancel: false }),
    { preserveWork: true, recordCancelled: false },
  );
});

test("explicit cancellation records cancellation and clears recoverable work", () => {
  assert.deepEqual(
    decideJobTermination({ pageUnloading: false, aborted: true, explicitCancel: true }),
    { preserveWork: false, recordCancelled: true },
  );
});

test("ordinary completion or failure does not preserve active work", () => {
  assert.deepEqual(
    decideJobTermination({ pageUnloading: false, aborted: false, explicitCancel: false }),
    { preserveWork: false, recordCancelled: false },
  );
});
```

- [ ] **Step 2: Add a test script and verify the test fails**

Add to `package.json`:

```json
"test": "node --experimental-strip-types --test lib/*.test.ts"
```

Run: `npm test`

Expected: FAIL because `lib/job-lifecycle.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure decision helper**

```ts
export type JobTerminationInput = {
  pageUnloading: boolean;
  aborted: boolean;
  explicitCancel: boolean;
};

export function decideJobTermination(input: JobTerminationInput) {
  if (input.pageUnloading)
    return { preserveWork: true, recordCancelled: false };
  if (input.aborted && input.explicitCancel)
    return { preserveWork: false, recordCancelled: true };
  return { preserveWork: false, recordCancelled: false };
}
```

- [ ] **Step 4: Run the focused test**

Run: `npm test`

Expected: all three lifecycle tests PASS.

- [ ] **Step 5: Record a local checkpoint**

Run: `npm run typecheck`

Expected: PASS. Do not commit because `/Users/xieyingjun/Documents/画室` has no `.git` repository.

---

### Task 2: Preserve active work during unload and resume polling safely

**Files:**
- Modify: `app/page.tsx` around imports, lifecycle refs, initialization effect, `runJob`, and the stop button.
- Modify: `lib/job-lifecycle.test.ts`

**Interfaces:**
- Consumes: `decideJobTermination` from Task 1.
- Preserves: existing `persistWork`, `clearSavedWork`, `createServerJob`, and `waitForServerJob` interfaces.

- [ ] **Step 1: Extend tests for an unload without an AbortError**

Add:

```ts
test("page unload wins even before fetch reports an abort", () => {
  assert.deepEqual(
    decideJobTermination({ pageUnloading: true, aborted: false, explicitCancel: false }),
    { preserveWork: true, recordCancelled: false },
  );
});
```

Run: `npm test`

Expected: PASS, documenting that the page lifecycle flag—not the browser's eventual error shape—controls refresh preservation.

- [ ] **Step 2: Add explicit lifecycle refs and listeners**

Import `decideJobTermination`. Add refs beside `abortRef`:

```ts
const pageUnloadingRef = useRef(false);
const explicitCancelRef = useRef(false);
```

In the existing scroll-persistence effect, set `pageUnloadingRef.current = true` in the `pagehide` and `beforeunload` handler before persisting scroll. Do not clear saved job work in this handler.

- [ ] **Step 3: Mark only the stop button as explicit cancellation**

Replace the stop action with:

```tsx
onClick={() => {
  explicitCancelRef.current = true;
  abortRef.current?.abort();
}}
```

Reset `explicitCancelRef.current = false` immediately before each new or resumed `runJob` begins polling.

- [ ] **Step 4: Guard `runJob` catch and finally**

In `catch`, calculate:

```ts
const aborted = e instanceof DOMException && e.name === "AbortError";
const termination = decideJobTermination({
  pageUnloading: pageUnloadingRef.current,
  aborted,
  explicitCancel: explicitCancelRef.current,
});
```

If `termination.preserveWork` is true, return without adding a failed/cancelled history turn. Otherwise preserve the existing error and cancellation behavior, using `termination.recordCancelled` for the cancelled status.

In `finally`, if `pageUnloadingRef.current` is true, call `persistWork(job, queueRef.current)` and return before clearing `pending`, queue state, or `dialogue-studio-work`. For all other terminal paths, retain the current cleanup and queue advancement behavior.

- [ ] **Step 5: Remove unsafe missing-job resubmission**

Replace the `resume && data.missing` branch that calls `createServerJob` with a clear error:

```ts
if (resume && data.missing)
  throw new Error(
    "任务状态已丢失，未自动重新生成以避免重复扣费。",
  );
```

This applies whether or not references were saved, because a missing in-memory job does not prove the provider failed to complete or charge for the original request.

- [ ] **Step 6: Run all non-paid verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands PASS. Confirm by source inspection that the resume path calls only `waitForServerJob`, never `createServerJob`, and that the stop button is the only place setting `explicitCancelRef.current = true`.

- [ ] **Step 7: Perform a browser-safe recovery check**

Use a mocked or locally controlled job response, not Apilio/CherryIN/BFL. Verify one job ID survives repeated refreshes, partial images reappear, completion enters history, explicit stop records cancellation, and a 404 displays the non-resubmission warning.

- [ ] **Step 8: Record final local checkpoint**

List the modified files and verification outputs. Do not claim real provider end-to-end validation because no paid generation is allowed, and do not commit because the directory is not a Git repository.
