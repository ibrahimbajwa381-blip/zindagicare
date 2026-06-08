"use client";

import { useEffect, useRef } from "react";

export function useSundayRealtime(
  doctorId: string | null,
  dateKey: string | null,
  onEvent: () => void,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!doctorId || !dateKey) return;

    const url = `/api/v1/sunday/events?doctorId=${doctorId}&date=${dateKey}`;
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
  }, [doctorId, dateKey]);
}
