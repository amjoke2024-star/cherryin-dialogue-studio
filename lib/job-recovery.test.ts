import assert from "node:assert/strict";
import test from "node:test";
import { restorePendingJob } from "./job-recovery.ts";

test("an already submitted job resumes without requiring its provider key", () => {
  const saved = {
    queueId: "submitted-job-123",
    apiSource: "apilio" as const,
    serverStartedAt: 123456,
  };

  assert.deepEqual(restorePendingJob(saved, ""), {
    ...saved,
    apiKey: "",
  });
});

test("an unsubmitted job still requires its provider key", () => {
  const saved = {
    queueId: "local-only-job-123",
    apiSource: "apilio" as const,
    serverStartedAt: undefined,
  };

  assert.equal(restorePendingJob(saved, ""), null);
});
