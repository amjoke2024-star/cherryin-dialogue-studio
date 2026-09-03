import assert from "node:assert/strict";
import test from "node:test";
import {
  apilioProxyOptions,
  internalGenerationFetchTimeouts,
  providerFetchTimeouts,
  readableFetchError,
} from "./provider-fetch.ts";

test("Apilio transport adopts the configured HTTPS proxy without exposing it to other providers", () => {
  assert.deepEqual(
    apilioProxyOptions({
      HTTPS_PROXY: "http://127.0.0.1:10811",
      HTTP_PROXY: "http://127.0.0.1:10811",
      NO_PROXY: "localhost,127.0.0.1",
    }),
    {
      httpsProxy: "http://127.0.0.1:10811",
      httpProxy: "http://127.0.0.1:10811",
      noProxy: "localhost,127.0.0.1",
    },
  );
  assert.equal(apilioProxyOptions({}), null);
});

test("internal generation transport keeps long-running jobs open for ten minutes", () => {
  assert.deepEqual(internalGenerationFetchTimeouts(), {
    headersTimeout: 600_000,
    bodyTimeout: 600_000,
  });
});

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
