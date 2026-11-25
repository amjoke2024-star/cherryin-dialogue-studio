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

test("Apilio 5xx errors preserve status, provider code, and response request ID", () => {
  assert.equal(
    providerError(
      { error: { code: "upstream_unavailable", message: "private upstream details" } },
      503,
      "Apilio",
      "req-abc123",
    ),
    "Apilio 图片服务暂时异常（HTTP 503，错误代码 upstream_unavailable）。请求编号：req-abc123",
  );
});

test("Apilio 5xx can be diagnosed when no upstream error code or request ID was returned", () => {
  assert.equal(
    providerError({ message: "<html>Bad Gateway</html>" }, 502, "Apilio"),
    "Apilio 图片服务暂时异常（HTTP 502）。请先检查 Apilio 后台的使用记录。",
  );
});
