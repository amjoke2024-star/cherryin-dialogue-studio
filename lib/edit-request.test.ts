import assert from "node:assert/strict";
import test from "node:test";
import { appendEditReferenceFiles } from "./edit-request.ts";

test("the edit mask is sent in the mask field instead of as a second reference image", async () => {
  const form = new FormData();
  await appendEditReferenceFiles(form, [
    { name: "原图.png", data: "source" },
    { name: "产品编辑蒙版.png", data: "mask", role: "mask" },
  ], async (reference) => new File([reference.data], reference.name, { type: "image/png" }));

  assert.deepEqual(form.getAll("image").map((value) => (value as File).name), ["原图.png"]);
  assert.equal((form.get("mask") as File).name, "产品编辑蒙版.png");
});
