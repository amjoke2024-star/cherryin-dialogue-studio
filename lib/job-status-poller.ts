export type JobStatusSnapshot = {
  status: "running" | "completed" | "failed" | "missing";
  images?: string[];
  references?: unknown[];
  error?: string;
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
  for (;;) {
    let snapshot: JobStatusSnapshot;
    try {
      snapshot = await read();
      transientFailures = 0;
    } catch (error) {
      if (transientFailures >= transientRetryLimit) throw error;
      transientFailures += 1;
      await sleep();
      continue;
    }
    if (snapshot.status === "missing") {
      if (missingReads >= tolerateMissingReads) return snapshot;
      missingReads += 1;
      await sleep();
      continue;
    }
    missingReads = 0;
    onProgress(snapshot.images || []);
    if (snapshot.status === "completed" || snapshot.status === "failed")
      return snapshot;
    await sleep();
  }
}
