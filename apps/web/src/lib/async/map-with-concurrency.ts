/**
 * Runs `fn` over `items` with at most `concurrency` in flight at once, preserving
 * result order. Used for fan-out I/O (bulk notification/push delivery) where full
 * `Promise.all` could exceed a downstream provider's rate limit.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current], current);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
