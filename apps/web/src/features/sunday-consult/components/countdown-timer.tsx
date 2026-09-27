"use client";

import { useCountdownRemaining } from "@/hooks/use-countdown-remaining";

export function CountdownTimer({ targetDate }: { targetDate: Date | string }) {
  const remaining = useCountdownRemaining(targetDate);

  if (remaining === null) {
    return (
      <span className="font-mono text-sm font-semibold text-slate-400" aria-hidden>
        --:--:--
      </span>
    );
  }

  if (remaining <= 0) {
    return (
      <span className="font-mono text-sm font-semibold text-brand">
        Session window open
      </span>
    );
  }

  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  const parts =
    d > 0
      ? [`${d}d`, `${h}h`, `${m}m`, `${s}s`]
      : [`${h}h`, `${m}m`, `${s}s`];

  return (
    <span className="font-mono text-sm font-semibold text-foreground">
      {parts.join(" ")}
    </span>
  );
}
