"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribes to a JSON-payload SSE endpoint and calls `onEvent` for every
 * non-"connected" message. Shared base behind the per-feature realtime hooks
 * (Sunday consult, urgent consult) — identical connection lifecycle across
 * both, differing only in how each builds its endpoint URL.
 */
export function useEventSourceListener(url: string | null, onEvent: () => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!url) return;

    const source = new EventSource(url);

    source.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data) as { type?: string };
        if (!payload.type || payload.type === "connected") return;
        onEventRef.current();
      } catch {
        // Ignore malformed events.
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [url]);
}
