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
