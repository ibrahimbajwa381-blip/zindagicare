"use client";

import { useEffect, useState } from "react";

export function CountdownTimer({ targetDate }: { targetDate: Date | string }) {
  const target = new Date(targetDate).getTime();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

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

  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  return (
    <span className="font-mono text-sm font-semibold text-foreground">
      {h}h {m}m {s}s
    </span>
  );
}
