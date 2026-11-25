export type JobTerminationInput = {
  pageUnloading: boolean;
  aborted: boolean;
  explicitCancel: boolean;
};

export type StudioMode = "generate" | "text-edit" | "product-blend" | "image-upscale";

export function normalizeStudioMode(value: unknown): StudioMode {
  return value === "text-edit" || value === "product-blend" || value === "image-upscale"
    ? value
    : "generate";
}

export function supportsMultipleImages(mode: StudioMode) {
  return mode !== "text-edit";
}

export function generationCountForMode(mode: StudioMode, requestedCount: number) {
  return supportsMultipleImages(mode)
    ? Math.max(1, Math.min(4, Number(requestedCount) || 1))
    : 1;
}

export function partialGenerationMessage(
  apiSource: string,
  requestedCount: number,
  completedCount: number,
  failureReason?: string,
) {
  const missingCount = Math.max(0, requestedCount - completedCount);
  if (failureReason)
    return `请求 ${requestedCount} 张，画室收到 ${completedCount} 张。其余结果未收到，画室未重新发起生成。详情：${failureReason}`;
  if (apiSource === "apilio")
    return `请求 ${requestedCount} 张，画室收到 ${completedCount} 张；另外 ${missingCount} 张可能已在 Apilio 后台生成，但结果回传失败。请先检查后台，未自动重试以避免重复扣费。`;
  return `请求 ${requestedCount} 张，实际成功 ${completedCount} 张。已保留成功结果，未自动重试以避免重复扣费。`;
}

export function decideJobTermination(input: JobTerminationInput) {
  if (input.pageUnloading)
    return { preserveWork: true, recordCancelled: false };
  if (input.aborted && input.explicitCancel)
    return { preserveWork: false, recordCancelled: true };
  return { preserveWork: false, recordCancelled: false };
}

export function generationTiming(
  submittedAt: number,
  serverStartedAt: number | undefined,
  completedAt: number,
) {
  const startedAt = serverStartedAt || submittedAt;
  return {
    queueWaitMs: Math.max(0, startedAt - submittedAt),
    generationDurationMs: Math.max(0, completedAt - startedAt),
  };
}

export function missingImageCount(turn: {
  images: string[];
  requestedCount?: number;
  status?: string;
  error?: string;
}) {
  if (!turn.images.length || turn.status === "unconfirmed") return 0;
  const legacyCount = Number(/^请求 ([1-4]) 张/.exec(turn.error || "")?.[1]);
  const requested = turn.requestedCount || legacyCount || turn.images.length;
  return Math.max(0, Math.min(4, requested) - turn.images.length);
}
