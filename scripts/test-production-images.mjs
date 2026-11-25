import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import sharp from "sharp";

const root = await mkdtemp(path.join(tmpdir(), "studio-production-test-"));
let server;
let browser;
let serverOutput = "";

try {
  const manifest = JSON.parse(await readFile(".next/server/app-paths-manifest.json", "utf8"));
  assert.ok(manifest["/generated/[filename]/route"], "Production build is missing the original-image route");

  const socket = createServer().listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  socket.close();
  await once(socket, "close");
  const origin = `http://127.0.0.1:${port}`;

  server = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port),
  ], {
    env: { ...process.env, CHERRYIN_STUDIO_ROOT: root },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (chunk) => { serverOutput += chunk; });

  await waitForServer(server, origin);
  // The files must be introduced after Next has indexed the public directory.
  const createdAt = Date.now();
  const prompt = "生产构建图片验证";
  const images = ["/generated/production-first.png", "/generated/production-second.png"];
  const originals = await Promise.all(["#745ea0", "#26938a"].map((background) =>
    sharp({ create: { width: 1200, height: 800, channels: 3, background } }).png().toBuffer(),
  ));
  await mkdir(path.join(root, "data"));
  await mkdir(path.join(root, "public", "generated"), { recursive: true });
  await Promise.all(images.map((name, index) =>
    writeFile(path.join(root, "public", name), originals[index]),
  ));
  await writeFile(path.join(root, "data", "history.json"), JSON.stringify([
    ...Array.from({ length: 24 }, (_, index) => ({
      id: `recent-${index}`,
      prompt: `历史记录 ${index + 1}`,
      createdAt: createdAt - 24 + index,
      images: [],
    })),
    {
      id: "production-image-test", prompt, createdAt, images, requestedCount: 3,
      apiSource: "apilio", modelId: "gpt-image-2.6-sunburst-2k", size: "2048x1536",
      error: "请求 3 张，画室收到 2 张。",
      diagnostics: ["文生图提交 · 直连 · HTTP 503 · 请求编号：smoke-request-id"],
    },
  ]));

  const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === "darwin" ? "chrome" : undefined);
  browser = await chromium.launch({ channel });
  const page = await browser.newPage({ acceptDownloads: true });
  page.setDefaultTimeout(10_000);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await page.addInitScript(() => {
    localStorage.setItem("dialogue-studio-apilio-api-key", "smoke-test-key");
    localStorage.setItem("dialogue-studio-api-source", "apilio");
  });
  await page.route("**/api/models**", (route) => route.fulfill({ json: { models: [{
    id: "gpt-image-2.6-sunburst-2k", name: "Sunburst 2K", note: "Apilio",
    mark: "◇", fixedUnitPrice: 0.1, estimatedPricingGroup: "default",
  }] } }));
  await page.goto(origin);
  const recent = page.getByRole("navigation", { name: "最近记录" });
  const oldest = recent.getByText("历史记录 1", { exact: true });
  await oldest.scrollIntoViewIfNeeded();
  assert.equal(await recent.locator(".recent-item").count(), 25);
  assert.ok(await recent.evaluate((element) => element.scrollTop > 0));
  const oldestRow = recent.locator(".recent-item").filter({ has: page.getByText("历史记录 1", { exact: true }) });
  await oldest.hover();
  await oldestRow.getByRole("button", { name: "记录操作" }).click();
  await oldestRow.getByRole("button", { name: "删除该批次结果" }).hover();
  await page.keyboard.press("Escape");
  await oldest.click();
  assert.equal(await page.getByRole("textbox").inputValue(), "历史记录 1");
  const card = page.locator("article").filter({ hasText: prompt });
  const search = page.getByRole("searchbox", { name: "搜索历史" });
  await search.fill("sunburst-2K");
  assert.equal(await recent.locator(".recent-item").count(), 1);
  await card.getByRole("button", { name: "收藏", exact: true }).click();
  await card.getByRole("button", { name: "已收藏", exact: true }).waitFor();
  await page.reload();
  await card.getByRole("button", { name: "已收藏", exact: true }).waitFor();
  await page.getByRole("button", { name: "收藏", exact: true }).first().click();
  assert.equal(await recent.locator(".recent-item").count(), 1);
  await page.getByText("¥0.1/张 × 1 · 默认组预计 ¥0.1", { exact: true }).waitFor();
  await card.getByAltText("生成结果 1").click();
  const dialog = page.getByRole("dialog", { name: "图片预览" });
  await waitForOriginal(page, 1);
  await dialog.getByRole("button", { name: "下一张" }).click();
  await waitForOriginal(page, 2);
  await verifyDownload(page, dialog.getByRole("link", { name: "下载" }), originals[1]);
  await dialog.getByRole("button", { name: "用作参考" }).click();
  await page.locator(".attachment-name img").waitFor();
  assert.equal(await page.locator(".attachment-name img").getAttribute("src"), images[1]);
  const firstResult = card.locator("figure").first();
  await firstResult.hover();
  await firstResult.getByRole("button", { name: "用作参考" }).click();
  assert.equal(await page.locator(".attachment-name img").count(), 2);

  const encoded = new URLSearchParams({ createdAt: String(createdAt) });
  images.forEach((image) => encoded.append("file", image));
  const batch = await page.request.get(`${origin}/api/download-batch?${encoded}`);
  assert.equal(batch.status(), 200);
  const archive = await batch.body();
  verifyArchive(archive, originals);
  await verifyDownload(page, card.getByRole("button", { name: "全部下载" }), archive);
  await card.getByRole("button", { name: "复制诊断信息" }).click();
  await card.getByRole("button", { name: "已复制" }).waitFor();
  const diagnostic = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(diagnostic, /gpt-image-2.6-sunburst-2k/);
  assert.match(diagnostic, /文生图提交 · 直连 · HTTP 503 · 请求编号：smoke-request-id/);
  assert.doesNotMatch(diagnostic, /smoke-test-key/);

  const supplement = "/generated/production-third.png";
  await writeFile(path.join(root, "public", supplement), originals[0]);
  const submissions = [];
  await page.route("**/api/jobs", async (route) => {
    const job = route.request().postDataJSON();
    submissions.push(job);
    await route.fulfill({ status: 202, json: { jobId: job.jobId, status: "running" } });
  });
  await page.route("**/api/jobs/*", (route) =>
    route.fulfill({ json: { status: "completed", images: [supplement] } }),
  );
  let confirmation;
  page.once("dialog", (dialog) => {
    confirmation = dialog.message();
    return dialog.accept();
  });
  await card.getByRole("button", { name: "补生成 1 张" }).click();
  await card.getByRole("img", { name: "生成结果 3" }).waitFor();
  assert.equal(submissions.length, 1);
  assert.match(confirmation, /默认组预计 ¥0.1/);
  assert.equal(submissions[0].count, 1);
  assert.equal(submissions[0].model, "gpt-image-2.6-sunburst-2k");
  assert.equal(submissions[0].size, "2048x1536");
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem("dialogue-studio-history"))
    .find((turn) => turn.id === "production-image-test"));
  assert.deepEqual(result.images, [...images, supplement]);
  console.log("Production smoke test passed: history search, favorites, image references, price estimates, downloads and supplement.");

} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill();
    await once(server, "exit");
  }
  await rm(root, { recursive: true, force: true });
}

async function waitForServer(process, origin) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (process.exitCode !== null || process.signalCode !== null) throw new Error("Next exited before startup");
    const response = await fetch(origin, { signal: AbortSignal.timeout(1000) }).catch(() => null);
    if (response?.ok) {
      await response.body.cancel();
      return;
    }
    await delay(250);
  }
  throw new Error("Next did not start in time");
}

async function waitForOriginal(page, index) {
  await page.waitForFunction((number) => {
    const img = document.querySelector(`img[alt="放大预览 ${number}"]`);
    return img?.naturalWidth === 1200 && img.naturalHeight === 800;
  }, index);
}

async function verifyDownload(page, control, expected) {
  const pending = page.waitForEvent("download");
  await control.click();
  const download = await pending;
  assert.equal(await download.failure(), null);
  assert.deepEqual(await readFile(await download.path()), expected);
}

function verifyArchive(zip, originals) {
  let offset = 0;
  for (const original of originals) {
    assert.equal(zip.readUInt32LE(offset), 0x04034b50);
    assert.equal(zip.readUInt16LE(offset + 8), 0, "Expected a stored PNG");
    const size = zip.readUInt32LE(offset + 18);
    const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
    assert.deepEqual(zip.subarray(start, start + size), original);
    offset = start + size;
  }
  assert.equal(zip.readUInt32LE(offset), 0x02014b50);
}
