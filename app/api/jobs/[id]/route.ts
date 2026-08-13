import { NextRequest, NextResponse } from "next/server";
import { jobs, pruneJobs } from "../store";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  pruneJobs();
  const { id } = await context.params;
  const job = jobs.get(id);
  if (!job) return NextResponse.json({ error: "任务不存在或服务已重启。" }, { status: 404 });
  return NextResponse.json({ status: job.status, ...(job.result || {}) });
}
