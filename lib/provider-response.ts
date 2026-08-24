export type ProviderResponseContext = {
  providerName: string;
  operation: string;
  model: string;
  size?: string;
  headersElapsedMs: number;
};

export function providerRequestId(headers: Headers) {
  return headers.get("x-request-id")
    || headers.get("request-id")
    || headers.get("cf-ray")
    || "";
}

export async function readProviderResponseText(
  response: Response,
  context: ProviderResponseContext,
) {
  try {
    return await response.text();
  } catch (error) {
    const requestId = providerRequestId(response.headers) || "未提供";
    const detail = error instanceof Error ? error.message : "未知错误";
    throw new Error(
      `${context.providerName} ${context.operation}已收到响应头，但读取响应正文中断` +
      `（模型 ${context.model}，尺寸 ${context.size || "未指定"}，请求编号 ${requestId}，` +
      `响应头耗时 ${context.headersElapsedMs}ms）：${detail}`,
      { cause: error },
    );
  }
}
