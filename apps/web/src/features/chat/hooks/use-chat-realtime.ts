"use client";

import { useEffect, useRef } from "react";
import type { ChatRealtimeEvent } from "@/lib/realtime/chat-emitter";

const MAX_RECONNECT_DELAY_MS = 30_000;

export function useChatRealtime(onEvent: (event: ChatRealtimeEvent) => void) {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let stopped = false;

    function connect() {
      if (stopped) return;

      source?.close();
      source = new EventSource("/api/v1/chat/events");

      source.onmessage = (message) => {
        reconnectAttempts = 0;
        try {
          const payload = JSON.parse(message.data) as { type?: string };
          if (!payload.type || payload.type === "connected") return;
          onEventRef.current(payload as ChatRealtimeEvent);
        } catch {
          // Ignore malformed events.
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        if (stopped) return;

        const delay = Math.min(
          1_000 * 2 ** reconnectAttempts,
          MAX_RECONNECT_DELAY_MS,
        );
        reconnectAttempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
    };
  }, []);
}
