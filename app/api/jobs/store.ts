export type JobResult = {
  images?: string[];
  references?: Array<{ name: string; data: string }>;
  error?: string;
  requestedCount?: number;
  completedCount?: number;
  failedCount?: number;
};

export type StoredJob = {
  id: string;
  status: "running" | "completed" | "failed";
  createdAt: number;
  result?: JobResult;
};

const globalJobs = globalThis as typeof globalThis & { dialogueStudioJobs?: Map<string, StoredJob> };

export const jobs = globalJobs.dialogueStudioJobs ??= new Map<string, StoredJob>();

export function updateRunningJob(jobId: string, update: { image?: string; references?: Array<{ name: string; data: string }>; error?: string }) {
  const current = jobs.get(jobId);
  if (!current) return;
  const result = current.result || {};
  const images = update.image ? [...(result.images || []), update.image] : result.images || [];
  const failedCount = (result.failedCount || 0) + (update.error ? 1 : 0);
  jobs.set(jobId, {
    ...current,
    result: {
      ...result,
      images,
      references: update.references || result.references,
      error: update.error || result.error,
      completedCount: images.length,
      failedCount,
    },
  });
}

export function pruneJobs() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}
