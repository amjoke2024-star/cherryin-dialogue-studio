import { createPersistentJobStore, type PersistentJob } from "../../../lib/persistent-job-store";
import { studioPath } from "../../../lib/studio-paths";
import type { UpstreamImageTask } from "../../../lib/server-image-generation";

type JobResult = NonNullable<PersistentJob["result"]>;

const globalJobs = globalThis as typeof globalThis & {
  dialogueStudioJobs?: ReturnType<typeof createPersistentJobStore>;
  dialogueStudioActiveJobs?: Set<string>;
};

export const jobs = globalJobs.dialogueStudioJobs ??= createPersistentJobStore(
  studioPath("data", "jobs.json"),
);
const activeJobs = globalJobs.dialogueStudioActiveJobs ??= new Set<string>();

function settle(job: PersistentJob) {
  const result = job.result || {};
  const images = result.images || [];
  const requested = result.requestedCount || Math.max(1, images.length);
  const unfinished = requested - images.length - (result.failedCount || 0);
  const status = unfinished > 0 || Object.keys(job.upstream || {}).length
    ? "interrupted"
    : images.length ? "completed" : "failed";
  return { ...job, status } satisfies PersistentJob;
}

export function readJob(id: string) {
  const job = jobs.get(id);
  if (!job || job.status !== "running" || activeJobs.has(id)) return job;
  const settled = { ...settle(job), interruptedByRestart: true };
  jobs.set(id, settled);
  return settled;
}

export function snapshotJob(job: PersistentJob) {
  return {
    ...job.result,
    status: job.status,
    recoverable: job.status === "interrupted" && Object.keys(job.upstream || {}).length > 0,
    interruptedByRestart: job.status === "interrupted" && Boolean(job.interruptedByRestart),
  };
}

export function startJob(id: string, execute: () => Promise<void>) {
  const job = jobs.get(id);
  if (!job || activeJobs.has(id)) return;
  activeJobs.add(id);
  if (job.status !== "running")
    jobs.set(id, { ...job, status: "running", interruptedByRestart: false });
  void execute().catch((error: unknown) => {
    const current = jobs.get(id);
    if (current) {
      const message = error instanceof Error ? error.message : "任务执行中断。";
      jobs.set(id, { ...current, result: { ...current.result, error: message } });
    }
  }).finally(() => {
    activeJobs.delete(id);
    const current = jobs.get(id);
    if (current) jobs.set(id, settle(current));
  }).catch((error: unknown) => console.error("Could not save generation status", error));
}

export function checkpointTask(id: string, index: string, task: UpstreamImageTask) {
  const job = jobs.get(id);
  if (job) jobs.set(id, { ...job, upstream: { ...job.upstream, [index]: task } });
}

export function checkpointReferences(id: string, references: NonNullable<JobResult["references"]>) {
  const job = jobs.get(id);
  if (job) jobs.set(id, { ...job, result: { ...job.result, references } });
}

export function recordImageResult(
  id: string,
  index: string,
  update: { image?: string; error?: string; upstreamFailed?: boolean },
) {
  const job = jobs.get(id);
  if (!job) return;
  const result = job.result || {};
  const upstream = { ...job.upstream };
  const checkpoint = upstream[index];
  const isFailure = Boolean(update.error && (!checkpoint || update.upstreamFailed));
  if (update.image || isFailure) delete upstream[index];
  const images = update.image ? [...(result.images || []), update.image] : result.images || [];
  jobs.set(id, {
    ...job,
    upstream,
    result: {
      ...result,
      images,
      error: update.error || result.error,
      diagnostics: update.error
        ? [...new Set([...(result.diagnostics || []), update.error])].slice(-12)
        : result.diagnostics,
      completedCount: images.length,
      failedCount: (result.failedCount || 0) + Number(isFailure),
    },
  });
}

export function pruneJobs() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff && !activeJobs.has(id)) jobs.delete(id);
  }
}
