import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPersistentJobStore } from "./persistent-job-store.ts";

test("a running job survives creation of a fresh store instance", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "studio-jobs-"));
  const file = path.join(directory, "jobs.json");
  try {
    const firstProcess = await createPersistentJobStore(file);
    await firstProcess.set("job-12345678", {
      id: "job-12345678",
      status: "running",
      createdAt: 123456,
      result: { images: [], requestedCount: 1, completedCount: 0, failedCount: 0 },
    });

    const restartedProcess = await createPersistentJobStore(file);
    assert.deepEqual(restartedProcess.get("job-12345678"), {
      id: "job-12345678",
      status: "running",
      createdAt: 123456,
      result: { images: [], requestedCount: 1, completedCount: 0, failedCount: 0 },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
