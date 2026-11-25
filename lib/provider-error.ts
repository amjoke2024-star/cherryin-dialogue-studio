export function providerError(
  data: Record<string, unknown>,
  status: number,
  providerName: string,
  headerRequestId = "",
) {
  const nested = data?.error as { message?: unknown; code?: unknown } | string | undefined;
  const detail =
    typeof nested === "string"
      ? nested
      : typeof nested?.message === "string" ? nested.message : String(data?.message || "");
  const requestId = detail.match(/request ID\s+([a-zA-Z0-9-]+)/i)?.[1];
  if (status === 401) return "API Key 无效或已过期。";
  if (status === 402) return `${providerName} 余额不足。`;
  if (status === 429) return "请求太频繁，请稍后再试。";
  if (providerName === "Apilio" && status >= 500) {
    const code = typeof nested === "object" ? nested?.code : undefined;
    const errorCode = typeof code === "string" && /^[a-z0-9_]{1,64}$/i.test(code)
      ? `，错误代码 ${code}` : "";
    const id = /^[a-z0-9_.:-]{1,128}$/i.test(headerRequestId) ? headerRequestId : requestId;
    return `Apilio 图片服务暂时异常（HTTP ${status}${errorCode}）。${id
      ? `请求编号：${id}`
      : "请先检查 Apilio 后台的使用记录。"}`;
  }
  if (status >= 500)
    return `${providerName} 图片服务暂时异常。${
      requestId ? `请求编号：${requestId}` : "请稍后再试。"
    }`;
  return detail || `${providerName} 返回错误 ${status}`;
}
