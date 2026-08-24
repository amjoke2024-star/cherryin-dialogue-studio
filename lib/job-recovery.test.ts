import assert from "node:assert/strict";
import test from "node:test";
import {
  lightweightSavedJob,
  restorePendingJob,
} from "./job-recovery.ts";

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

test("saved work excludes every embedded source image while retaining job identity", () => {
  const largeImage = `data:image/png;base64,${"x".repeat(100_000)}`;
  const saved = lightweightSavedJob({
    queueId: "submitted-job-456",
    apiKey: "secret-key",
    serverStartedAt: 789,
    referencesOmitted: false,
    attachments: [{ name: "原图.png", data: largeImage }],
    productBlend: {
      sourceImage: { name: "原图.png", data: largeImage },
      productBox: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
      additionalPrompt: "",
    },
    textEdit: {
      sourceImage: { name: "原图.png", data: largeImage },
      regions: [],
    },
  });

  assert.equal(saved.queueId, "submitted-job-456");
  assert.equal(saved.serverStartedAt, 789);
  assert.equal("apiKey" in saved, false);
  assert.deepEqual(saved.attachments, []);
  assert.equal(saved.productBlend?.sourceImage.data, "");
  assert.equal(saved.textEdit?.sourceImage.data, "");
  assert.equal(saved.referencesOmitted, true);
  assert.ok(JSON.stringify(saved).length < 2_000);
});
