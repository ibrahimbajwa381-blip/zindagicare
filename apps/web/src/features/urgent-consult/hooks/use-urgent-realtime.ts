"use client";

import { useEffect, useRef } from "react";

export function useUrgentRealtime(
  patientId: string | null,
  appointmentId: string | null,
  onEvent: () => void,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!patientId && !appointmentId) return;

    const params = new URLSearchParams();
    if (patientId) params.set("patientId", patientId);
    if (appointmentId) params.set("appointmentId", appointmentId);

    const source = new EventSource(`/api/v1/urgent/events?${params.toString()}`);

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
  }, [patientId, appointmentId]);
}
