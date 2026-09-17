"use client";

import { useEventSourceListener } from "@/lib/realtime/use-event-source";

export function useSundayRealtime(
  doctorId: string | null,
  dateKey: string | null,
  onEvent: () => void,
) {
  const url =
    doctorId && dateKey ? `/api/v1/sunday/events?doctorId=${doctorId}&date=${dateKey}` : null;
  useEventSourceListener(url, onEvent);
}
