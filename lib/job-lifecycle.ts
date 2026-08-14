export type JobTerminationInput = {
  pageUnloading: boolean;
  aborted: boolean;
  explicitCancel: boolean;
};

export type StudioMode = "generate" | "text-edit";

export function normalizeStudioMode(value: unknown): StudioMode {
  return value === "text-edit" ? "text-edit" : "generate";
}

export function decideJobTermination(input: JobTerminationInput) {
  if (input.pageUnloading)
    return { preserveWork: true, recordCancelled: false };
  if (input.aborted && input.explicitCancel)
    return { preserveWork: false, recordCancelled: true };
  return { preserveWork: false, recordCancelled: false };
}
