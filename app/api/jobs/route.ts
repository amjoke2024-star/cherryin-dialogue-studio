import { NextRequest, NextResponse } from "next/server";
import {
  runGenerationRequests,
  shouldRunGenerationConcurrently,
} from "../../../lib/generation-scheduler";
import { generateImages, type ImageGenerationInput } from "../../../lib/server-image-generation";
import { checkpointReferences, checkpointTask, jobs, pruneJobs, readJob, recordImageResult, startJob } from "./store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as (ImageGenerationInput & { jobId?: string }) | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
  if (!body || !/^[a-zA-Z0-9-]{8,80}$/.test(jobId)) {
    return NextResponse.json({ error: "任务编号无效。" }, { status: 400 });
  }
  if (typeof body.apiKey !== "string" || !body.apiKey.trim() ||
      typeof body.prompt !== "string" || !body.prompt.trim()) {
    return NextResponse.json({ error: "请填写 API Key 和创作指令。" }, { status: 400 });
  }

  pruneJobs();
  const existing = readJob(jobId);
  if (existing) return NextResponse.json({ jobId, status: existing.status }, { status: 202 });

  const requestedCount = Math.max(1, Math.min(4, Math.trunc(Number(body.count)) || 1));
  jobs.set(jobId, {
    id: jobId,
    status: "running",
    createdAt: Date.now(),
    result: { images: [], requestedCount, completedCount: 0, failedCount: 0 },
  });

  startJob(jobId, () => runGenerationRequests({
    count: requestedCount,
    concurrent: shouldRunGenerationConcurrently(body.apiSource),
    execute: async (number) => {
      const index = String(number);
      const response = await generateImages(
        { ...body, count: 1, archiveReferences: number === 0 },
        (task) => checkpointTask(jobId, index, task),
        (references) => checkpointReferences(jobId, references),
      );
      const result = await response.json() as {
        images?: string[];
        error?: string;
        upstreamFailed?: boolean;
      };
      recordImageResult(jobId, index, response.ok && result.images?.length
        ? { image: result.images[0] }
        : { error: result.error || "生成失败", upstreamFailed: result.upstreamFailed });
    },
  }));

  return NextResponse.json({ jobId, status: "running" }, { status: 202 });
}
