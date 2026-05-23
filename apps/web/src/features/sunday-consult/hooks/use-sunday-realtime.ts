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

    source.onmessage = () => {
      onEventRef.current();
    };

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [doctorId, dateKey]);
}
