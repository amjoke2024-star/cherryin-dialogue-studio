export type EditReference = {
  name: string;
  data: string;
  transient?: boolean;
  role?: "mask";
};

export async function appendEditReferenceFiles(
  form: FormData,
  references: EditReference[],
  toFile: (reference: EditReference) => Promise<File>,
) {
  const images = references.filter((reference) => reference.role !== "mask");
  const mask = references.find((reference) => reference.role === "mask");
  const imageFiles = await Promise.all(images.map(toFile));
  imageFiles.forEach((file) => form.append("image", file));
  if (mask) form.append("mask", await toFile(mask));
}
