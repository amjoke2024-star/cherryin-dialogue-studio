import { Agent, EnvHttpProxyAgent, type Dispatcher } from "undici";

type ProxyEnvironment = Record<string, string | undefined>;

export function apilioProxyOptions(environment: ProxyEnvironment) {
  const httpsProxy = environment.HTTPS_PROXY || environment.https_proxy || environment.HTTP_PROXY || environment.http_proxy;
  const httpProxy = environment.HTTP_PROXY || environment.http_proxy || httpsProxy;
  if (!httpsProxy && !httpProxy) return null;
  const noProxy = environment.NO_PROXY || environment.no_proxy;
  return {
    httpsProxy: httpsProxy || httpProxy!,
    httpProxy: httpProxy || httpsProxy!,
    ...(noProxy ? { noProxy } : {}),
  };
}

const generationTimeout = 600_000;
const configuredApilioProxy = apilioProxyOptions(process.env);
const directApilioAgent = new Agent(providerFetchTimeouts("Apilio"));
const proxyApilioAgent: Dispatcher | null = configuredApilioProxy
  ? new EnvHttpProxyAgent({
      ...configuredApilioProxy,
      ...providerFetchTimeouts("Apilio"),
    })
  : null;
const internalGenerationAgent = new Agent(internalGenerationFetchTimeouts());

type ApilioRoute = "direct" | "proxy";

export function createApilioRouteSelector({
  probeDirect,
  proxyAvailable,
  now = Date.now,
  cacheMs = 5_000,
}: {
  probeDirect: () => Promise<void>;
  proxyAvailable: boolean;
  now?: () => number;
  cacheMs?: number;
}) {
  let cached: { route: ApilioRoute; expiresAt: number } | null = null;
  let pending: Promise<ApilioRoute> | null = null;
  return {
    async select(): Promise<ApilioRoute> {
      if (cached && cached.expiresAt > now()) return cached.route;
      if (!pending) {
        pending = (async () => {
          try {
            await probeDirect();
            return "direct" as const;
          } catch {
            return proxyAvailable ? "proxy" as const : "direct" as const;
          }
        })();
      }
      const route = await pending;
      pending = null;
      cached = { route, expiresAt: now() + cacheMs };
      return route;
    },
  };
}

async function probeDirectApilio() {
  const response = await fetch("https://api.apilio.ai/v1/models", {
    dispatcher: directApilioAgent,
    signal: AbortSignal.timeout(5_000),
  } as RequestInit & { dispatcher: Dispatcher });
  await response.body?.cancel();
}

const apilioRouteSelector = createApilioRouteSelector({
  probeDirect: probeDirectApilio,
  proxyAvailable: Boolean(proxyApilioAgent),
});

export function internalGenerationFetchTimeouts() {
  return { headersTimeout: generationTimeout, bodyTimeout: generationTimeout };
}

export function providerFetchTimeouts(providerName: string) {
  const timeout = providerName === "Apilio" ? generationTimeout : 300_000;
  return { headersTimeout: timeout, bodyTimeout: timeout };
}

export async function providerFetch(
  input: string,
  init: RequestInit,
  providerName: string,
) {
  try {
    const apilioRoute = providerName === "Apilio"
      ? await apilioRouteSelector.select()
      : null;
    const dispatcher = apilioRoute === "direct"
      ? directApilioAgent
      : apilioRoute === "proxy"
        ? proxyApilioAgent || directApilioAgent
        : undefined;
    return await fetch(input, {
      ...init,
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit & { dispatcher?: Dispatcher });
  } catch (error) {
    throw new Error(readableFetchError(error, providerName), { cause: error });
  }
}

export async function internalGenerationFetch(
  input: string | URL,
  init: RequestInit,
) {
  return fetch(input, {
    ...init,
    dispatcher: internalGenerationAgent,
  } as RequestInit & { dispatcher: Agent });
}

export function readableFetchError(error: unknown, providerName: string) {
  const cause = error instanceof Error ? error.cause : undefined;
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? String(cause.code)
      : "";
  if (code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT")
    return `${providerName} 连接等待响应超时（${code}）。`;
  if (providerName === "Apilio" && code === "UND_ERR_SOCKET")
    return "Apilio 结果回传中断（UND_ERR_SOCKET）。请求可能已在后台生成，请先检查 Apilio 后台；画室未自动重试，避免重复扣费。";
  if (error instanceof Error && error.message !== "fetch failed")
    return error.message;
  return code
    ? `${providerName} 连接失败（${code}）。`
    : `${providerName} 连接失败。`;
}
