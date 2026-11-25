import { NextRequest, NextResponse } from "next/server";
import { didUpstreamTaskFail, readUpstreamImageTask } from "../../../../lib/server-image-generation";
import { pruneJobs, readJob, recordImageResult, snapshotJob, startJob } from "../store";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  pruneJobs();
  const job = readJob((await context.params).id);
  if (!job) return NextResponse.json({ error: "任务记录不存在。" }, { status: 404 });
  return NextResponse.json(snapshotJob(job));
}

export async function POST(request: NextRequest, context: Context) {
  const body = await request.json().catch(() => null) as { apiKey?: string } | null;
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) return NextResponse.json({ error: "请先填写该渠道的 API Key。" }, { status: 400 });
  pruneJobs();
  const job = readJob((await context.params).id);
  if (!job) return NextResponse.json({ error: "任务记录不存在。" }, { status: 404 });
  const tasks = Object.entries(job.upstream || {});
  if (job.status !== "interrupted" || !tasks.length) return NextResponse.json(snapshotJob(job));

  startJob(job.id, async () => {
    await Promise.all(tasks.map(async ([index, task]) => {
      try {
        const [image] = await readUpstreamImageTask(apiKey, task);
        if (!image) throw new Error("原任务暂未返回图片。");
        recordImageResult(job.id, index, { image });
      } catch (error) {
        recordImageResult(job.id, index, {
          error: error instanceof Error ? error.message : "读取原任务失败。",
          upstreamFailed: didUpstreamTaskFail(error),
        });
      }
    }));
  });
  return NextResponse.json({ status: "running" }, { status: 202 });
}
