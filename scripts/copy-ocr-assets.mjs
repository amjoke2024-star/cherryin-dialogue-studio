import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "public", "ocr");
const tesseractRoot = path.join(root, "node_modules", "tesseract.js");
const coreRoot = path.join(root, "node_modules", "tesseract.js-core");
const languageRoot = path.join(
  root,
  "node_modules",
  "@tesseract.js-data",
  "chi_sim",
  "4.0.0",
);

await mkdir(output, { recursive: true });
await copyFile(
  path.join(tesseractRoot, "dist", "worker.min.js"),
  path.join(output, "worker.min.js"),
);
await copyFile(
  path.join(languageRoot, "chi_sim.traineddata.gz"),
  path.join(output, "chi_sim.traineddata.gz"),
);

const coreAssets = (await readdir(coreRoot)).filter(
  (name) => name.startsWith("tesseract-core") && (name.endsWith(".wasm") || name.endsWith(".wasm.js")),
);

if (coreAssets.length < 12) {
  throw new Error(`OCR core assets are incomplete in ${coreRoot}`);
}

await Promise.all(
  coreAssets.map((name) => copyFile(path.join(coreRoot, name), path.join(output, name))),
);

console.log(`Prepared ${coreAssets.length + 2} offline OCR assets in ${output}`);
