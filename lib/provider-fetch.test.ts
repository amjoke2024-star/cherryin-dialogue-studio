import assert from "node:assert/strict";
import test from "node:test";
import {
  providerFetchTimeouts,
  readableFetchError,
} from "./provider-fetch.ts";

test("Apilio transport waits as long as the existing ten minute generation timeout", () => {
  assert.deepEqual(providerFetchTimeouts("Apilio"), {
    headersTimeout: 600_000,
    bodyTimeout: 600_000,
  });
});

test("transport errors retain the underlying undici timeout code", () => {
  const error = new TypeError("fetch failed", {
    cause: Object.assign(new Error("Headers Timeout Error"), {
      code: "UND_ERR_HEADERS_TIMEOUT",
    }),
  });

  assert.equal(
    readableFetchError(error, "Apilio"),
    "Apilio 连接等待响应超时（UND_ERR_HEADERS_TIMEOUT）。",
  );
});
