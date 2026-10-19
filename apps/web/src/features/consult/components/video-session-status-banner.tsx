"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { getSundayFreeJoinWindow, getVideoJoinWindow, AppointmentStatuses } from "@zindagi/shared";
import { useTranslations } from "@/i18n/locale-provider";

type Props = {
  scheduledStart: string;
  scheduledEnd: string;
  appointmentStatus?: string;
  /** Sunday free consult — stays open until the doctor finishes it. */
  openUntilClosed?: boolean;
};

function formatCountdown(remainingMs: number) {
  const d = Math.floor(remainingMs / 86400000);
  const h = Math.floor((remainingMs % 86400000) / 3600000);
  const m = Math.floor((remainingMs % 3600000) / 60000);
  const s = Math.floor((remainingMs % 60000) / 1000);

  const parts =
    d > 0 ? [`${d}d`, `${h}h`, `${m}m`, `${s}s`] : [`${h}h`, `${m}m`, `${s}s`];

  return parts.join(" ");
}

export function VideoSessionStatusBanner({
  scheduledStart,
  scheduledEnd,
  appointmentStatus,
  openUntilClosed = false,
}: Props) {
  const t = useTranslations();
  const copy = t.consult.videoSession;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now === null) {
    return (
      <div className="rounded-xl border border-brand-light/30 bg-brand-muted/50 px-4 py-3">
        <p className="text-xs text-slate-500">{copy.startsIn}</p>
        <span className="font-mono text-sm font-semibold text-slate-400" aria-hidden>
          --:--:--
        </span>
      </div>
    );
  }

  const { joinOpensAt, joinClosesAt, canJoin } = openUntilClosed
    ? getSundayFreeJoinWindow(scheduledStart, new Date(now))
    : getVideoJoinWindow(scheduledStart, scheduledEnd, new Date(now));

  const attendedPastWindow =
    appointmentStatus === AppointmentStatuses.COMPLETED ||
    (appointmentStatus === AppointmentStatuses.IN_PROGRESS &&
      now > joinClosesAt.getTime());

  if (now > joinClosesAt.getTime() && !attendedPastWindow) {
    return (
      <div className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {copy.missedTitle}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-red-700">{copy.missedDescription}</p>
      </div>
    );
  }

  if (attendedPastWindow) {
    return (
      <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-800">{copy.consultationCompleted}</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-700">
          {copy.consultationCompletedDescription}
        </p>
      </div>
    );
  }

  if (canJoin) {
    return (
      <div className="rounded-xl border border-brand-light/30 bg-brand-muted/50 px-4 py-3">
        <p className="text-xs text-slate-500">{copy.sessionOpenLabel}</p>
        <p className="font-mono text-sm font-semibold text-brand">{copy.sessionWindowOpen}</p>
      </div>
    );
  }

  const remaining = Math.max(0, joinOpensAt.getTime() - now);

  return (
    <div className="rounded-xl border border-brand-light/30 bg-brand-muted/50 px-4 py-3">
      <p className="text-xs text-slate-500">{copy.startsIn}</p>
      <span className="font-mono text-sm font-semibold text-foreground">
        {formatCountdown(remaining)}
      </span>
    </div>
  );
}
