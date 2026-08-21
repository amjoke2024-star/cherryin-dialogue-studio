import assert from "node:assert/strict";
import test from "node:test";
import { providerError } from "./provider-error.ts";

test("GoAPI edit failures keep the GoAPI provider name and request identifier", () => {
  assert.equal(
    providerError(
      { error: { message: "upstream unavailable (request ID abc-123)" } },
      503,
      "GoAPI",
    ),
    "GoAPI 图片服务暂时异常。请求编号：abc-123",
  );
});

test("provider-specific balance errors do not fall back to CherryIN", () => {
  assert.equal(providerError({}, 402, "GoAPI"), "GoAPI 余额不足。");
});
