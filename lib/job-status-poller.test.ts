import assert from "node:assert/strict";
import test from "node:test";
import { waitForJobStatus } from "./job-status-poller.ts";

test("a temporary status fetch failure is retried without recreating the paid job", async () => {
  let reads = 0;
  let sleeps = 0;
  const result = await waitForJobStatus({
    read: async () => {
      reads += 1;
      if (reads === 1) throw new TypeError("fetch failed");
      return { status: "completed" as const, images: ["/generated/result.png"] };
    },
    sleep: async () => {
      sleeps += 1;
    },
  });

  assert.deepEqual(result.images, ["/generated/result.png"]);
  assert.equal(reads, 2);
  assert.equal(sleeps, 1);
});

test("a newly prestarted job tolerates a short 404 race before it becomes visible", async () => {
  let reads = 0;
  const result = await waitForJobStatus({
    read: async () => {
      reads += 1;
      if (reads === 1) return { status: "missing" as const };
      return { status: "completed" as const, images: ["/generated/result.png"] };
    },
    sleep: async () => {},
    tolerateMissingReads: 2,
  });

  assert.equal(result.status, "completed");
  assert.equal(reads, 2);
});

test("a permanently missing restored job is returned as missing", async () => {
  let reads = 0;
  const result = await waitForJobStatus({
    read: async () => {
      reads += 1;
      return { status: "missing" as const };
    },
    sleep: async () => {},
    tolerateMissingReads: 2,
  });

  assert.equal(result.status, "missing");
  assert.equal(reads, 3);
});

test("repeated status failures stop after the safe read-only retry budget", async () => {
  let reads = 0;
  await assert.rejects(
    waitForJobStatus({
      read: async () => {
        reads += 1;
        throw new TypeError("fetch failed");
      },
      sleep: async () => {},
      transientRetryLimit: 3,
    }),
    /fetch failed/,
  );
  assert.equal(reads, 4);
});
