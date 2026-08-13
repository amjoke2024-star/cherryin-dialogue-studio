import assert from "node:assert/strict";
import test from "node:test";
import {
  runGenerationRequests,
  shouldRunGenerationConcurrently,
} from "./generation-scheduler.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("concurrent mode starts four requests before any request finishes", async () => {
  const gates = Array.from({ length: 4 }, deferred);
  const started: number[] = [];
  const running = runGenerationRequests({
    count: 4,
    concurrent: true,
    execute: async (index) => {
      started.push(index);
      await gates[index].promise;
    },
  });

  await Promise.resolve();
  assert.deepEqual(started, [0, 1, 2, 3]);
  gates.forEach((gate) => gate.resolve());
  await running;
});

test("sequential mode starts the next request only after the previous finishes", async () => {
  const gates = Array.from({ length: 3 }, deferred);
  const started: number[] = [];
  const running = runGenerationRequests({
    count: 3,
    concurrent: false,
    execute: async (index) => {
      started.push(index);
      await gates[index].promise;
    },
  });

  await Promise.resolve();
  assert.deepEqual(started, [0]);
  gates[0].resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(started, [0, 1]);
  gates[1].resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(started, [0, 1, 2]);
  gates[2].resolve();
  await running;
});

test("concurrent callbacks can capture one failure while all requests finish", async () => {
  const completed: number[] = [];
  const failed: number[] = [];

  await runGenerationRequests({
    count: 4,
    concurrent: true,
    execute: async (index) => {
      try {
        if (index === 1) throw new Error("rate limited");
        completed.push(index);
      } catch {
        failed.push(index);
      }
    },
  });

  assert.deepEqual(completed, [0, 2, 3]);
  assert.deepEqual(failed, [1]);
});

test("request count is clamped to four", async () => {
  const started: number[] = [];
  await runGenerationRequests({
    count: 9,
    concurrent: true,
    execute: async (index) => {
      started.push(index);
    },
  });
  assert.deepEqual(started, [0, 1, 2, 3]);
});

test("every image provider uses concurrent generation", () => {
  for (const source of ["apilio", "cherryin", "bfl", "future-provider"])
    assert.equal(shouldRunGenerationConcurrently(source), true);
});
