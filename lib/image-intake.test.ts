import assert from "node:assert/strict";
import test from "node:test";
import {
  imageIntakeTarget,
  installPagePasteListener,
} from "./image-intake.ts";

test("pasted images follow the active studio mode", () => {
  assert.equal(imageIntakeTarget("generate"), "attachments");
  assert.equal(imageIntakeTarget("text-edit"), "text-edit");
  assert.equal(imageIntakeTarget("product-blend"), "product-blend");
});

test("page paste listener receives paste anywhere and is removable", () => {
  const page = new EventTarget();
  let calls = 0;
  const remove = installPagePasteListener(page, () => {
    calls += 1;
  });

  page.dispatchEvent(new Event("paste"));
  assert.equal(calls, 1);

  remove();
  page.dispatchEvent(new Event("paste"));
  assert.equal(calls, 1);
});
