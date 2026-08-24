import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export type PersistentJob = {
  id: string;
  status: "running" | "completed" | "failed";
  createdAt: number;
  result?: {
    images?: string[];
    references?: Array<{ name: string; data: string }>;
    error?: string;
    requestedCount?: number;
    completedCount?: number;
    failedCount?: number;
  };
};

export type PersistentJobStore = {
  get(id: string): PersistentJob | undefined;
  set(id: string, job: PersistentJob): PersistentJobStore;
  delete(id: string): boolean;
  [Symbol.iterator](): MapIterator<[string, PersistentJob]>;
};

export function createPersistentJobStore(file: string): PersistentJobStore {
  const jobs = loadJobs(file);
  const save = () => {
    mkdirSync(path.dirname(file), { recursive: true });
    const temporaryFile = `${file}.${process.pid}.tmp`;
    writeFileSync(temporaryFile, JSON.stringify([...jobs.values()]), "utf8");
    renameSync(temporaryFile, file);
  };
  const store: PersistentJobStore = {
    get: (id) => jobs.get(id),
    set(id, job) {
      jobs.set(id, job);
      save();
      return store;
    },
    delete(id) {
      const deleted = jobs.delete(id);
      if (deleted) save();
      return deleted;
    },
    [Symbol.iterator]: () => jobs[Symbol.iterator](),
  };
  return store;
}

function loadJobs(file: string) {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as PersistentJob[];
    return new Map(
      Array.isArray(parsed)
        ? parsed
            .filter((job) => job?.id && job?.status && Number.isFinite(job.createdAt))
            .map((job) => [job.id, job] as const)
        : [],
    );
  } catch {
    return new Map<string, PersistentJob>();
  }
}
