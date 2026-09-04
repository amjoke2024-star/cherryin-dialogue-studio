import assert from "node:assert/strict";
import test from "node:test";
import * as providerTransport from "./provider-fetch.ts";

const {
  apilioProxyOptions,
  internalGenerationFetchTimeouts,
  providerFetchTimeouts,
  readableFetchError,
} = providerTransport;

test("Apilio paid requests prefer direct transport when its preflight succeeds", async () => {
  const createApilioRouteSelector = Reflect.get(providerTransport, "createApilioRouteSelector");
  assert.equal(typeof createApilioRouteSelector, "function");
  const selector = createApilioRouteSelector({
    probeDirect: async () => {},
    proxyAvailable: true,
  });
  assert.equal(await selector.select(), "direct");
});

test("Apilio paid requests use the configured proxy only when direct preflight fails", async () => {
  const createApilioRouteSelector = Reflect.get(providerTransport, "createApilioRouteSelector");
  assert.equal(typeof createApilioRouteSelector, "function");
  const selector = createApilioRouteSelector({
    probeDirect: async () => {
      throw new Error("direct unavailable");
    },
    proxyAvailable: true,
  });
  assert.equal(await selector.select(), "proxy");
});

test("parallel Apilio requests share one route preflight", async () => {
  const createApilioRouteSelector = Reflect.get(providerTransport, "createApilioRouteSelector");
  assert.equal(typeof createApilioRouteSelector, "function");
  let probes = 0;
  const selector = createApilioRouteSelector({
    probeDirect: async () => {
      probes += 1;
      await Promise.resolve();
    },
    proxyAvailable: true,
  });
  assert.deepEqual(
    await Promise.all([selector.select(), selector.select(), selector.select()]),
    ["direct", "direct", "direct"],
  );
  assert.equal(probes, 1);
});

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

test("Apilio socket failures warn that a paid result may already exist", () => {
  const error = new TypeError("fetch failed", {
    cause: Object.assign(new Error("other side closed"), {
      code: "UND_ERR_SOCKET",
    }),
  });

  assert.equal(
    readableFetchError(error, "Apilio"),
    "Apilio 结果回传中断（UND_ERR_SOCKET）。请求可能已在后台生成，请先检查 Apilio 后台；画室未自动重试，避免重复扣费。",
  );
});
