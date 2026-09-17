"use client";

import { useCountdownRemaining } from "@/hooks/use-countdown-remaining";

export function UrgentCountdownTimer({ targetDate }: { targetDate: Date | string }) {
  const remaining = useCountdownRemaining(targetDate);

  if (remaining === null) {
    return (
      <span className="font-mono text-sm font-semibold text-slate-400" aria-hidden>
        --:--
      </span>
    );
  }

  if (remaining <= 0) {
    return (
      <span className="font-mono text-sm font-semibold text-brand">
        Doctor should call now
      </span>
    );
  }

  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  return (
    <span className="font-mono text-lg font-bold text-brand-dark">
      {m}:{s.toString().padStart(2, "0")}
    </span>
  );
}
