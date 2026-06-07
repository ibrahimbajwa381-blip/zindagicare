"use client";

import { useEffect, useRef } from "react";
import type { ChatRealtimeEvent } from "@/lib/realtime/chat-emitter";

export function useChatRealtime(onEvent: (event: ChatRealtimeEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource("/api/v1/chat/events");

    source.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data) as { type?: string };
        if (!payload.type || payload.type === "connected") return;
        onEventRef.current(payload as ChatRealtimeEvent);
      } catch {
        // Ignore malformed events.
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, []);
}
