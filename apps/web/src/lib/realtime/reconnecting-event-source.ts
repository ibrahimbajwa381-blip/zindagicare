/**
 * EventSource with exponential-backoff reconnect (same schedule as
 * use-chat-realtime) and resync hooks for recovering missed events:
 *
 *  - `onResync` fires on every "connected" message (first connect and each
 *    reconnect) and when a previously hidden tab becomes visible again, so the
 *    caller can re-fetch whatever it may have missed.
 *  - `onEvent` fires for every other JSON message with a `type`.
 *
 * Framework-free so it can be unit-tested without a DOM.
 */

export type RealtimeMessage = { type: string; [key: string]: unknown };

export type EventSourceLike = {
  onmessage: ((message: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(): void;
};

type VisibilityTarget = {
  readonly visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
};

export type ReconnectingEventSourceOptions = {
  url: string;
  onEvent: (message: RealtimeMessage) => void;
  onResync: (reason: "connected" | "visible") => void;
  createEventSource?: (url: string) => EventSourceLike;
  visibility?: VisibilityTarget | null;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

export const DEFAULT_RECONNECT_BASE_MS = 1_000;
export const MAX_RECONNECT_DELAY_MS = 30_000;

/** Starts the connection; returns a cleanup that stops it for good. */
export function connectReconnectingEventSource(options: ReconnectingEventSourceOptions): () => void {
  const {
    url,
    createEventSource = (u) => new EventSource(u) as unknown as EventSourceLike,
    visibility = typeof document === "undefined" ? null : document,
    baseDelayMs = DEFAULT_RECONNECT_BASE_MS,
    maxDelayMs = MAX_RECONNECT_DELAY_MS,
  } = options;

  let source: EventSourceLike | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let stopped = false;
  let wasHidden = false;

  function connect() {
    if (stopped) return;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    source?.close();
    const current = createEventSource(url);
    source = current;

    current.onmessage = (message) => {
      if (stopped || source !== current) return;
      let payload: Partial<RealtimeMessage>;
      try {
        payload = JSON.parse(message.data) as Partial<RealtimeMessage>;
      } catch {
        return; // Ignore malformed events.
      }
      if (!payload || typeof payload.type !== "string") return;
      if (payload.type === "connected") {
        reconnectAttempts = 0;
        options.onResync("connected");
        return;
      }
      options.onEvent(payload as RealtimeMessage);
    };

    current.onerror = () => {
      // Closing stops the browser's own retry, so the schedule below is the only one.
      current.close();
      if (source !== current) return;
      source = null;
      if (stopped) return;

      const delay = Math.min(baseDelayMs * 2 ** reconnectAttempts, maxDelayMs);
      reconnectAttempts += 1;
      reconnectTimer = setTimeout(connect, delay);
    };
  }

  function onVisibilityChange() {
    if (!visibility) return;
    if (visibility.visibilityState === "hidden") {
      wasHidden = true;
      return;
    }
    if (!wasHidden) return;
    wasHidden = false;
    // Always refresh through the API: if the stream is down (network, 429),
    // a reconnect alone may fail and leave the page stale.
    options.onResync("visible");
    if (!source) {
      // Waiting out a backoff: try the stream again now.
      reconnectAttempts = 0;
      connect();
    }
  }

  visibility?.addEventListener("visibilitychange", onVisibilityChange);
  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    visibility?.removeEventListener("visibilitychange", onVisibilityChange);
    source?.close();
    source = null;
  };
}
