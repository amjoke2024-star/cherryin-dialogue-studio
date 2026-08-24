export function restorePendingJob<T extends { serverStartedAt?: number }>(
  saved: T | undefined,
  providerKey: string,
): (T & { apiKey: string }) | null {
  if (!saved) return null;
  if (!saved.serverStartedAt && !providerKey.trim()) return null;
  return { ...saved, apiKey: providerKey };
}
