import { Agent } from "undici";

const generationTimeout = 600_000;
const apilioAgent = new Agent(providerFetchTimeouts("Apilio"));
const internalGenerationAgent = new Agent(internalGenerationFetchTimeouts());

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
    return await fetch(input, {
      ...init,
      ...(providerName === "Apilio" ? { dispatcher: apilioAgent } : {}),
    } as RequestInit & { dispatcher?: Agent });
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
  if (error instanceof Error && error.message !== "fetch failed")
    return error.message;
  return code
    ? `${providerName} 连接失败（${code}）。`
    : `${providerName} 连接失败。`;
}
