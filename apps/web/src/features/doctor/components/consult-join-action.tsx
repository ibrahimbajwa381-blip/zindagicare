"use client";

import Link from "next/link";
import { Video } from "lucide-react";
import { AppointmentTypes } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { videoConsultPath } from "@/features/consult/paths";
import { useVideoJoinWindow } from "@/features/consult/hooks/use-video-join-window";
import type { DoctorRequestOutcome } from "@/server/services/doctor-dashboard.service";

type Props = {
  appointmentId: string;
  type: string;
  outcome: DoctorRequestOutcome;
  scheduledStart: string;
  scheduledEnd: string;
};

const VIDEO_TYPES = [
  AppointmentTypes.ONLINE,
  AppointmentTypes.URGENT_ONLINE,
  AppointmentTypes.SUNDAY_FREE,
] as const;

function formatCountdown(msRemaining: number) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function ConsultJoinAction({
  appointmentId,
  type,
  outcome,
  scheduledStart,
  scheduledEnd,
}: Props) {
  const { canJoin, joinOpensAt } = useVideoJoinWindow(scheduledStart, scheduledEnd);

  if (!VIDEO_TYPES.includes(type as (typeof VIDEO_TYPES)[number])) return null;
  if (outcome === "missed" || outcome === "cancelled" || outcome === "completed") {
    return null;
  }

  if (canJoin || outcome === "in_progress") {
    return (
      <Button size="sm" asChild className="gap-1">
        <Link href={videoConsultPath(appointmentId)}>
          <Video className="h-3.5 w-3.5" />
          Join call
        </Link>
      </Button>
    );
  }

  const msUntilJoin = joinOpensAt.getTime() - Date.now();
  if (msUntilJoin <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
      <Video className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      Joinable in {formatCountdown(msUntilJoin)}
    </span>
  );
}
