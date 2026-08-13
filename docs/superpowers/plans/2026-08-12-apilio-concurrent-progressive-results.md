# All-provider Concurrent Progressive Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run up to four image requests concurrently for every provider and publish each successful image as soon as it completes.

**Architecture:** Use the existing async scheduler for every provider and make the provider policy explicit and testable. The existing job store remains the source of progressive status, so each settled call updates images or failure counts immediately.

**Tech Stack:** Next.js 16 route handlers, TypeScript 5.9, Node.js 22 built-in test runner.

## Global Constraints

- Apilio, CherryIN, and BFL support 1–4 concurrent `count: 1` requests per job.
- Each success updates the stored job immediately; final status waits for all requests.
- Failed calls are never automatically retried.
- Refresh recovery never creates a replacement paid request.
- Tests must not call real providers.
- The directory is not a Git repository; use local verification checkpoints instead of commits.

---

### Task 1: Provider-aware scheduler

**Files:**
- Create: `lib/generation-scheduler.ts`
- Create: `lib/generation-scheduler.test.ts`

**Interfaces:**
- Produces: `runGenerationRequests(options: { count: number; concurrent: boolean; execute: (index: number) => Promise<void> }): Promise<void>`.

- [ ] Write tests using deferred promises that assert all four concurrent callbacks start before any resolves, while sequential mode starts only the next callback after the previous resolves.
- [ ] Run `npm test` and verify failure because the scheduler module is missing.
- [ ] Implement a clamped 1–4 scheduler: concurrent mode awaits `Promise.all(Array.from(...execute))`; sequential mode awaits each callback in a loop.
- [ ] Run `npm test` and verify all lifecycle and scheduler tests pass.

### Task 2: All-provider route policy and progressive updates

**Files:**
- Modify: `app/api/jobs/route.ts`
- Modify: `lib/generation-scheduler.test.ts`

**Interfaces:**
- Consumes: `runGenerationRequests` from Task 1.
- Preserves: `updateRunningJob(jobId, { image?, references?, error? })` and the existing `/api/jobs/[id]` response.

- [ ] Add policy tests proving Apilio, CherryIN, BFL, and an unknown future source all select concurrent scheduling.
- [ ] Export `shouldRunGenerationConcurrently(apiSource: unknown): boolean` from the scheduler module and return `true`.
- [ ] In `POST`, call the scheduler with `concurrent: shouldRunGenerationConcurrently(body.apiSource)` and the existing single-image fetch body.
- [ ] Keep each request's `try/catch` inside `execute`; call `updateRunningJob` immediately on success or failure.
- [ ] After the scheduler completes, retain the existing final-state rule: any images means completed, no images means failed.
- [ ] Confirm there is no retry loop and each index calls `/api/generate` exactly once.

### Task 3: Verification and service reload

**Files:**
- Verify: all modified source and test files.

- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Inspect the route to confirm every provider selects concurrent mode and progressive `updateRunningJob` remains inside each request completion.
- [ ] Restart the existing `com.cherryin.dialogue-studio` service and confirm port 3100 responds.
- [ ] Report that mocked concurrency was verified and real paid timing remains for the user's next normal task.
