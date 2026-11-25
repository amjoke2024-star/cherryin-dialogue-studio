import assert from "node:assert/strict";
import test from "node:test";
import {
  apilioGenerationHeaders,
  apilioTaskOutcome,
  apilioTaskUrl,
} from "./apilio-async-image.ts";

test("Apilio generation asks for one asynchronous task instead of holding the paid request open", () => {
  assert.deepEqual(apilioGenerationHeaders("secret"), {
    Authorization: "Bearer secret",
    "Content-Type": "application/json",
    Prefer: "respond-async",
  });
});

test("Apilio task responses resolve to the advertised polling endpoint", () => {
  assert.equal(
    apilioTaskUrl("https://api.apilio.ai", {}, { task_id: "task 123", status: "queued" }),
    "https://api.apilio.ai/v1/images/tasks/task%20123",
  );
  assert.equal(
    apilioTaskUrl(
      "https://api.apilio.ai",
      { location: "/v1/images/tasks/task_456" },
      { task_id: "task_456" },
    ),
    "https://api.apilio.ai/v1/images/tasks/task_456",
  );
});

test("completed Apilio tasks expose the normal image entries", () => {
  assert.deepEqual(
    apilioTaskOutcome({ status: "completed", data: [{ url: "https://cdn.example/image.png" }] }),
    { state: "completed", entries: [{ url: "https://cdn.example/image.png" }] },
  );
});

test("failed Apilio tasks preserve the upstream reason", () => {
  assert.deepEqual(
    apilioTaskOutcome({ status: "failed", error: { message: "model unavailable" } }),
    { state: "failed", error: "model unavailable" },
  );
});

test("Apilio edit task polling reads the documented success envelope", () => {
  const entry = { url: "https://cdn.example/edited.png" };
  assert.deepEqual(
    apilioTaskOutcome({ code: "success", data: { status: "SUCCESS", data: { data: [entry] } } }),
    { state: "completed", entries: [entry] },
  );
});

test("Apilio edit task polling reads the documented failure envelope", () => {
  assert.deepEqual(
    apilioTaskOutcome({ code: "success", data: { status: "FAILURE", fail_reason: "model unavailable" } }),
    { state: "failed", error: "model unavailable" },
  );
});

test("Apilio task polling stays on the API origin even if another host is advertised", () => {
  assert.equal(
    apilioTaskUrl("https://api.apilio.ai", { location: "https://other.example/task" }, { task_id: "edit-123" }),
    "https://api.apilio.ai/v1/images/tasks/edit-123",
  );
});
