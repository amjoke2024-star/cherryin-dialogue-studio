import { NextRequest, NextResponse } from "next/server";
import {
  runGenerationRequests,
  shouldRunGenerationConcurrently,
} from "../../../lib/generation-scheduler";
import { internalGenerationFetch } from "../../../lib/provider-fetch";
import { jobs, pruneJobs, updateRunningJob } from "./store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown> & { jobId?: string; count?: number };
  const jobId = body.jobId?.trim();
  if (!jobId || !/^[a-zA-Z0-9-]{8,80}$/.test(jobId)) {
    return NextResponse.json({ error: "任务编号无效。" }, { status: 400 });
  }

  pruneJobs();
  const existing = jobs.get(jobId);
  if (existing) return NextResponse.json({ jobId, status: existing.status }, { status: 202 });

  const requestedCount = Math.max(1, Math.min(4, Number(body.count) || 1));
  jobs.set(jobId, {
    id: jobId,
    status: "running",
    createdAt: Date.now(),
    result: { images: [], requestedCount, completedCount: 0, failedCount: 0 },
  });
  const generateURL = new URL("/api/generate", request.nextUrl.origin);
  const generationBody = { ...body };
  delete generationBody.jobId;

  void (async () => {
    await runGenerationRequests({
      count: requestedCount,
      concurrent: shouldRunGenerationConcurrently(body.apiSource),
      execute: async (index) => {
        try {
          const response = await internalGenerationFetch(generateURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...generationBody,
              count: 1,
              archiveReferences: index === 0,
            }),
          });
          const result = await response.json() as {
            images?: string[];
            references?: Array<{ name: string; data: string }>;
            error?: string;
          };
          if (!response.ok || !result.images?.length)
            throw new Error(result.error || "生成失败");
          updateRunningJob(jobId, {
            image: result.images[0],
            references: result.references,
          });
        } catch (error) {
          updateRunningJob(jobId, {
            error: error instanceof Error ? error.message : "生成失败",
          });
        }
      },
    });
    const current = jobs.get(jobId);
    if (!current) return;
    const images = current.result?.images || [];
    jobs.set(jobId, {
      ...current,
      status: images.length ? "completed" : "failed",
      result: {
        ...current.result,
        error: images.length ? undefined : current.result?.error || "生成失败",
      },
    });
  })();

  return NextResponse.json({ jobId, status: "running" }, { status: 202 });
}
