export type ClipboardWriter = {
  writeText(text: string): Promise<void>;
};

export async function copyText(
  text: string,
  clipboard: ClipboardWriter | undefined = typeof navigator === "undefined" ? undefined : navigator.clipboard,
): Promise<boolean> {
  if (!text || !clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
