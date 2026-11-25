export type JobStatusSnapshot = {
  status: "running" | "completed" | "failed" | "missing" | "interrupted" | "unavailable";
  images?: string[];
  references?: unknown[];
  error?: string;
  diagnostics?: string[];
  recoverable?: boolean;
  interruptedByRestart?: boolean;
  requestedCount?: number;
  completedCount?: number;
};

type WaitForJobStatusOptions = {
  read: () => Promise<JobStatusSnapshot>;
  sleep: () => Promise<void>;
  onProgress?: (images: string[]) => void;
  tolerateMissingReads?: number;
  transientRetryLimit?: number;
};

export async function waitForJobStatus({
  read,
  sleep,
  onProgress = () => {},
  tolerateMissingReads = 0,
  transientRetryLimit = 5,
}: WaitForJobStatusOptions): Promise<JobStatusSnapshot> {
  let missingReads = 0;
  let transientFailures = 0;
  let latest: JobStatusSnapshot | undefined;
  for (;;) {
    let snapshot: JobStatusSnapshot;
    try {
      snapshot = await read();
      transientFailures = 0;
    } catch (error) {
      if (transientFailures >= transientRetryLimit)
        return {
          ...latest,
          status: "unavailable",
          error: error instanceof Error ? error.message : "无法读取任务状态。",
        };
      transientFailures += 1;
      await sleep();
      continue;
    }
    if (snapshot.status === "missing") {
      if (missingReads >= tolerateMissingReads) return { ...latest, ...snapshot };
      missingReads += 1;
      await sleep();
      continue;
    }
    missingReads = 0;
    latest = snapshot;
    onProgress(snapshot.images || []);
    if (snapshot.status !== "running")
      return snapshot;
    await sleep();
  }
}
