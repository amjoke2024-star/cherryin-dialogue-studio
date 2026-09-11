export type ApilioPricingCatalog = {
  models?: Array<{
    key?: string;
    group_price?: Record<
      string,
      { type?: number; price?: number; group_ratio?: number }
    >;
    ratios?: { ratios?: number[] } | null;
  }>;
};

export function apilioPriceNote(
  note: string,
  modelId: string,
  catalog?: ApilioPricingCatalog | null,
) {
  const normalizedId = modelId.toLowerCase();
  const shortId = normalizedId.split("/").pop();
  const model = catalog?.models?.find((item) => {
    const key = item.key?.toLowerCase();
    return key === normalizedId || key === shortId;
  });
  const firstGroupPrice = Object.values(model?.group_price || {})[0];
  if (firstGroupPrice?.type !== 1) return note;
  const price = Number(firstGroupPrice.price);
  const groupRatio = Number(firstGroupPrice.group_ratio);
  if (!Number.isFinite(price) || !Number.isFinite(groupRatio)) return note;
  const total = Number((price * groupRatio).toFixed(5));
  if (total < 0) return note;
  const suffix = model?.ratios?.ratios?.length ? "起" : "";
  const source = note
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)
    .reverse()
    .join(" · ");
  return `¥${total}/次${suffix} · ${source}`;
}
