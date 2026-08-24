import assert from "node:assert/strict";
import test from "node:test";
import { imageIntakeTarget } from "./image-intake.ts";

test("pasted images follow the active studio mode", () => {
  assert.equal(imageIntakeTarget("generate"), "attachments");
  assert.equal(imageIntakeTarget("text-edit"), "text-edit");
  assert.equal(imageIntakeTarget("product-blend"), "product-blend");
});
