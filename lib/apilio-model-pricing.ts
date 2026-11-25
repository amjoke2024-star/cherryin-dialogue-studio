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

function findPricingModel(modelId: string, catalog?: ApilioPricingCatalog | null) {
  const normalizedId = modelId.toLowerCase();
  const shortId = normalizedId.split("/").pop();
  return catalog?.models?.find((item) => item.key?.toLowerCase() === normalizedId)
    || catalog?.models?.find((item) => item.key?.toLowerCase() === shortId);
}

export function apilioFixedUnitPrice(modelId: string, catalog?: ApilioPricingCatalog | null) {
  const model = findPricingModel(modelId, catalog);
  if (!model || model.ratios?.ratios?.length) return undefined;
  const prices = Object.values(model.group_price || {}).map(fixedGroupPrice);
  const first = prices[0];
  return first !== undefined && prices.every((price) => price === first) ? first : undefined;
}

export function apilioDefaultUnitPrice(modelId: string, catalog?: ApilioPricingCatalog | null) {
  const model = findPricingModel(modelId, catalog);
  if (!model || model.ratios?.ratios?.length) return undefined;
  return fixedGroupPrice(model.group_price?.default);
}

function fixedGroupPrice(group?: { type?: number; price?: number; group_ratio?: number }) {
  if (group?.type !== 1 || typeof group.price !== "number" || typeof group.group_ratio !== "number")
    return undefined;
  const total = group.price * group.group_ratio;
  return total >= 0 && Number.isFinite(total) ? Number(total.toFixed(5)) : undefined;
}

export function apilioPriceNote(
  note: string,
  modelId: string,
  catalog?: ApilioPricingCatalog | null,
) {
  const model = findPricingModel(modelId, catalog);
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
