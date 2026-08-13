export type JobTerminationInput = {
  pageUnloading: boolean;
  aborted: boolean;
  explicitCancel: boolean;
};

export function decideJobTermination(input: JobTerminationInput) {
  if (input.pageUnloading)
    return { preserveWork: true, recordCancelled: false };
  if (input.aborted && input.explicitCancel)
    return { preserveWork: false, recordCancelled: true };
  return { preserveWork: false, recordCancelled: false };
}
