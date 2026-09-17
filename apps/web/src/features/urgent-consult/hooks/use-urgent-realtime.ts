"use client";

import { useEventSourceListener } from "@/lib/realtime/use-event-source";

export function useUrgentRealtime(
  patientId: string | null,
  appointmentId: string | null,
  onEvent: () => void,
) {
  const params = new URLSearchParams();
  if (patientId) params.set("patientId", patientId);
  if (appointmentId) params.set("appointmentId", appointmentId);
  const url = patientId || appointmentId ? `/api/v1/urgent/events?${params.toString()}` : null;

  useEventSourceListener(url, onEvent);
}
