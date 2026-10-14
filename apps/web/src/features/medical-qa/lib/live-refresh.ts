/**
 * Refresh scheduling for the live question thread. Realtime events only say
 * "something changed"; this turns any burst of them (plus reconnect/visibility
 * resyncs) into as few authorized re-fetches as possible, without overlapping
 * requests and without an older response overwriting newer data.
 */

export const QA_REFRESH_DEBOUNCE_MS = 400;

export type RefreshCoordinator = {
  /** Debounced refresh, for realtime events and resyncs. */
  schedule(): void;
  /**
   * Immediate refresh (after the viewer's own write). Resolves once a load that
   * started after this call has finished, so it reflects that write.
   */
  now(): Promise<void>;
  /** Cancels timers and the in-flight request; nothing is applied afterwards. */
  dispose(): void;
};

export function createRefreshCoordinator<T>(options: {
  load: (signal: AbortSignal) => Promise<T>;
  apply: (data: T) => void;
  debounceMs?: number;
  onError?: (error: unknown) => void;
}): RefreshCoordinator {
  const { load, apply, debounceMs = QA_REFRESH_DEBOUNCE_MS, onError } = options;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let controller: AbortController | null = null;
  let rerun: { promise: Promise<void>; resolve: () => void } | null = null;
  let latestSeq = 0;
  let disposed = false;

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function start(): Promise<void> {
    const seq = ++latestSeq;
    const ctrl = new AbortController();
    controller = ctrl;
    const run = (async () => {
      try {
        const data = await load(ctrl.signal);
        // Only the newest request may write; anything older is stale.
        if (!disposed && seq === latestSeq) apply(data);
      } catch (error) {
        if (!disposed && !ctrl.signal.aborted) onError?.(error);
      } finally {
        if (controller === ctrl) controller = null;
        inFlight = null;
        if (rerun && !disposed) {
          const pending = rerun;
          rerun = null;
          start().then(pending.resolve);
        } else if (rerun) {
          rerun.resolve();
          rerun = null;
        }
      }
    })();
    inFlight = run;
    return run;
  }

  function request(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (!inFlight) return start();
    // One request at a time: queue a single follow-up that covers every caller.
    if (!rerun) {
      let resolve: () => void = () => {};
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      rerun = { promise, resolve };
    }
    return rerun.promise;
  }

  return {
    schedule() {
      if (disposed) return;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void request();
      }, debounceMs);
    },
    now() {
      clearTimer();
      return request();
    },
    dispose() {
      disposed = true;
      clearTimer();
      controller?.abort();
      controller = null;
      rerun?.resolve();
      rerun = null;
    },
  };
}

/**
 * Remembers ids of answers this viewer just posted, so the realtime echo of
 * their own write doesn't trigger a second refresh. Each id is skipped once.
 */
export function createOwnEchoFilter(maxRemembered = 20) {
  const ids: string[] = [];
  return {
    remember(answerId: string) {
      ids.push(answerId);
      if (ids.length > maxRemembered) ids.shift();
    },
    /** True when the event is the echo of a remembered answer (and forgets it). */
    isOwnEcho(event: { type: string; answerId?: unknown }) {
      if (event.type !== "answer_created" || typeof event.answerId !== "string") return false;
      const index = ids.indexOf(event.answerId);
      if (index === -1) return false;
      ids.splice(index, 1);
      return true;
    },
  };
}
