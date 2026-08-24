export function restorePendingJob<T extends { serverStartedAt?: number }>(
  saved: T | undefined,
  providerKey: string,
): (T & { apiKey: string }) | null {
  if (!saved) return null;
  if (!saved.serverStartedAt && !providerKey.trim()) return null;
  return { ...saved, apiKey: providerKey };
}

type EmbeddedSource = { sourceImage: { data: string } };

export function lightweightSavedJob<
  T extends {
    apiKey: string;
    attachments?: Array<{ data: string }>;
    productBlend?: EmbeddedSource;
    textEdit?: EmbeddedSource;
    referencesOmitted?: boolean;
  },
>(input: T): Omit<T, "apiKey"> {
  const { apiKey: _apiKey, ...job } = input;
  const attachments = (job.attachments || []).filter((item) =>
    item.data.startsWith("/generated/"),
  );
  const stripEmbeddedImage = <S extends EmbeddedSource | undefined>(state: S): S =>
    state && !state.sourceImage.data.startsWith("/generated/")
      ? {
          ...state,
          sourceImage: { ...state.sourceImage, data: "" },
        }
      : state;
  return {
    ...job,
    attachments,
    productBlend: stripEmbeddedImage(job.productBlend),
    textEdit: stripEmbeddedImage(job.textEdit),
    referencesOmitted: Boolean(
      job.referencesOmitted ||
      attachments.length !== (job.attachments || []).length,
    ),
  } as Omit<T, "apiKey">;
}
