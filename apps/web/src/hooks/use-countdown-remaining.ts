"use client";

import { useEffect, useState } from "react";

/**
 * Milliseconds remaining until `targetDate`, ticking every second; `null` until the
 * first tick. Shared timer logic behind the Sunday-consult and urgent-consult
 * countdown displays, which render the remaining time very differently.
 */
export function useCountdownRemaining(targetDate: Date | string): number | null {
  const target = new Date(targetDate).getTime();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return remaining;
}
