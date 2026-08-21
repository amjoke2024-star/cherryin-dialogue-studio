export function providerError(
  data: Record<string, unknown>,
  status: number,
  providerName: string,
) {
  const nested = data.error as { message?: string } | string | undefined;
  const detail =
    typeof nested === "string"
      ? nested
      : nested?.message || String(data.message || "");
  const requestId = detail.match(/request ID\s+([a-zA-Z0-9-]+)/i)?.[1];
  if (status === 401) return "API Key 无效或已过期。";
  if (status === 402) return `${providerName} 余额不足。`;
  if (status === 429) return "请求太频繁，请稍后再试。";
  if (status >= 500)
    return `${providerName} 图片服务暂时异常。${
      requestId ? `请求编号：${requestId}` : "请稍后再试。"
    }`;
  return detail || `${providerName} 返回错误 ${status}`;
}
