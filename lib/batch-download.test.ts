import assert from "node:assert/strict";
import test from "node:test";
import { createZip, downloadImageBatch } from "./batch-download.ts";

test("downloadImageBatch starts one server ZIP download for the whole batch", () => {
  const downloads: Array<{ href: string; filename: string }> = [];

  const count = downloadImageBatch(
    ["/generated/first.png", "/generated/second.png", "/generated/third.png"],
    1787621793659,
    (href, filename) => downloads.push({ href, filename }),
  );

  assert.equal(count, 3);
  assert.deepEqual(downloads, [{
    href: "/api/download-batch?createdAt=1787621793659&file=%2Fgenerated%2Ffirst.png&file=%2Fgenerated%2Fsecond.png&file=%2Fgenerated%2Fthird.png",
    filename: "cherryin-1787621793659.zip",
  }]);
});

test("createZip stores all numbered images in a valid ZIP structure", () => {
  const archive = createZip([
    { name: "cherryin-1787621793659-1.png", data: new TextEncoder().encode("one") },
    { name: "cherryin-1787621793659-2.png", data: new TextEncoder().encode("two") },
    { name: "cherryin-1787621793659-3.png", data: new TextEncoder().encode("three") },
  ]);

  assert.deepEqual(Array.from(archive.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  const archiveText = new TextDecoder().decode(archive);
  assert.match(archiveText, /cherryin-1787621793659-1\.png/);
  assert.match(archiveText, /cherryin-1787621793659-2\.png/);
  assert.match(archiveText, /cherryin-1787621793659-3\.png/);
});

test("downloadImageBatch ignores an empty image list", () => {
  let called = false;

  const count = downloadImageBatch([], 1787621793659, () => {
    called = true;
  });

  assert.equal(count, 0);
  assert.equal(called, false);
});
