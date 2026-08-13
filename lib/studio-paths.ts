import path from "node:path";

const studioRoot = process.env.CHERRYIN_STUDIO_ROOT || process.cwd();

export function studioPath(...segments: string[]) {
  return path.join(/*turbopackIgnore: true*/ studioRoot, ...segments);
}
