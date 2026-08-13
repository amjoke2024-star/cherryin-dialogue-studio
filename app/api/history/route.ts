import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { studioPath } from "../../../lib/studio-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Attachment = { name: string; data: string };
type HistoryTurn = {
  id: string;
  prompt: string;
  images: string[];
  createdAt: number;
  attachments?: Attachment[];
  [key: string]: unknown;
};

const historyDirectory = studioPath("data");
const historyFile = path.join(historyDirectory, "history.json");
let writeQueue = Promise.resolve();

function validTurn(value: unknown): value is HistoryTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Partial<HistoryTurn>;
  return typeof turn.id === "string" && turn.id.length > 0 &&
    typeof turn.prompt === "string" && Array.isArray(turn.images) &&
    turn.images.every((image) => typeof image === "string") &&
    typeof turn.createdAt === "number";
}

async function readHistory() {
  try {
    const parsed = JSON.parse(await readFile(historyFile, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter(validTurn).slice(-60) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeHistory(items: HistoryTurn[]) {
  const safeItems = items.filter(validTurn).slice(-60);
  writeQueue = writeQueue.then(async () => {
    await mkdir(historyDirectory, { recursive: true });
    const temporaryFile = `${historyFile}.${process.pid}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(safeItems), "utf8");
    await rename(temporaryFile, historyFile);
  });
  await writeQueue;
  return safeItems;
}

export async function GET() {
  try {
    return NextResponse.json({ items: await readHistory() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "无法读取共享历史记录。" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { items?: unknown };
    if (!Array.isArray(body.items) || !body.items.every(validTurn)) {
      return NextResponse.json({ error: "历史记录格式无效。" }, { status: 400 });
    }
    const items = await writeHistory(body.items);
    return NextResponse.json({ items, saved: items.length });
  } catch {
    return NextResponse.json({ error: "无法保存共享历史记录。" }, { status: 500 });
  }
}
