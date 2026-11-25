export function retainStudioHistory<T extends { favorite?: unknown }>(items: T[]) {
  let ordinary = 0;
  return [...items].reverse()
    .filter((item) => item.favorite === true || ++ordinary <= 120)
    .reverse();
}

export function matchesStudioHistory(
  turn: { prompt: string; modelName?: string; modelId?: string },
  query: string,
) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [turn.prompt, turn.modelName, turn.modelId].join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
