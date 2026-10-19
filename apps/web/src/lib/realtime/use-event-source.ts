"use client";

import { useEffect, useRef } from "react";
import { connectReconnectingEventSource, type RealtimeMessage } from "./reconnecting-event-source";

export type { RealtimeMessage };

/** Passed to `onEvent` when it runs to recover possibly missed events. */
export const RESYNC_MESSAGE: RealtimeMessage = { type: "resync" };

/**
 * Subscribes to a JSON-payload SSE endpoint and calls `onEvent` for every
 * non-"connected" message. Shared base behind the per-feature realtime hooks
 * (medical Q&A, Sunday consult, urgent consult).
 *
 * Reconnects with exponential backoff after errors, and also calls `onEvent`
 * with RESYNC_MESSAGE on every (re)connect and when a hidden tab becomes
 * visible again — `onEvent` must therefore be a safe, idempotent re-fetch.
 */
export function useEventSourceListener(url: string | null, onEvent: (message: RealtimeMessage) => void) {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!url) return;
    return connectReconnectingEventSource({
      url,
      onEvent: (message) => onEventRef.current(message),
      onResync: () => onEventRef.current(RESYNC_MESSAGE),
    });
  }, [url]);
}
