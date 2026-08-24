type DownloadOptions = {
  fetcher?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
};

const downloadTimeout = 120_000;
const downloadAttempts = 2;

export async function fetchGeneratedImage(url: string, options: DownloadOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let lastStatus = 0;
  let lastError: unknown;

  for (let attempt = 0; attempt < downloadAttempts; attempt += 1) {
    try {
      const response = await fetcher(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(downloadTimeout),
      });
      lastStatus = response.status;
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    if (attempt < downloadAttempts - 1) await wait(1_500);
  }

  const timedOut = lastError instanceof DOMException && lastError.name === "TimeoutError";
  if (timedOut) {
    throw new Error("图片已生成，但下载超时。请勿直接重新生成，可稍后重试取回结果。");
  }
  throw new Error(`图片已生成，但下载失败${lastStatus ? `（${lastStatus}）` : ""}。请勿直接重新生成。`);
}
