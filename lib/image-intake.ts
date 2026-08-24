import type { StudioMode } from "./job-lifecycle.ts";

export function imageIntakeTarget(mode: StudioMode) {
  return mode === "text-edit"
    ? "text-edit"
    : mode === "product-blend"
      ? "product-blend"
      : "attachments";
}
