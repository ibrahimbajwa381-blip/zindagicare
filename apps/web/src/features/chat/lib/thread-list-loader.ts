/**
 * Loads the inbox thread list for polling and realtime refreshes:
 * - concurrent `load` calls share the request already in flight (no pile-up
 *   when the API is slower than the poll interval);
 * - `loadFresh` waits out any in-flight request, then loads again, so data
 *   written just before the call (e.g. a newly created thread) is included;
 * - a failed refresh keeps the rows already on screen instead of clearing them;
 * - `onSettled` fires after every attempt so the caller can end the first-load state.
 */
export function createThreadListLoader<T>(
  fetchRows: () => Promise<T[]>,
  onRows: (rows: T[]) => void,
  onSettled: () => void,
) {
  let inFlight: Promise<void> | null = null;

  const load = (): Promise<void> => {
    inFlight ??= fetchRows()
      .then(onRows, (error: unknown) => {
        console.error("[chat] thread list refresh failed", {
          error: error instanceof Error ? error.name : "unknown",
        });
      })
      .finally(() => {
        inFlight = null;
        onSettled();
      });
    return inFlight;
  };

  const loadFresh = (): Promise<void> => (inFlight ? inFlight.then(load) : load());

  return { load, loadFresh };
}
