type GenerationSchedulerOptions = {
  count: number;
  concurrent: boolean;
  execute: (index: number) => Promise<void>;
};

export function shouldRunGenerationConcurrently(_apiSource: unknown) {
  return true;
}

export async function runGenerationRequests({
  count,
  concurrent,
  execute,
}: GenerationSchedulerOptions) {
  const requestCount = Math.max(1, Math.min(4, Number(count) || 1));
  if (concurrent) {
    await Promise.all(
      Array.from({ length: requestCount }, (_, index) => execute(index)),
    );
    return;
  }
  for (let index = 0; index < requestCount; index += 1)
    await execute(index);
}
