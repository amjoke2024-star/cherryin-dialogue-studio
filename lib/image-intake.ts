import type { StudioMode } from "./job-lifecycle.ts";

export function imageIntakeTarget(mode: StudioMode) {
  return mode === "text-edit"
    ? "text-edit"
    : mode === "product-blend"
      ? "product-blend"
      : mode === "image-upscale"
        ? "image-upscale"
      : "attachments";
}

export function installPagePasteListener(
  target: EventTarget,
  listener: (event: Event) => void,
) {
  const handlePaste: EventListener = (event) => listener(event);
  target.addEventListener("paste", handlePaste);
  return () => target.removeEventListener("paste", handlePaste);
}
