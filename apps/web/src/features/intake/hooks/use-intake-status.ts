"use client";

import { useEffect, useState } from "react";

export function useIntakeStatus(appointmentId: string | undefined) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!appointmentId) return;

    let cancelled = false;
    fetch(`/api/v1/intake/${appointmentId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success && json.data) {
          setStatus(json.data.status as string);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  return status;
}
