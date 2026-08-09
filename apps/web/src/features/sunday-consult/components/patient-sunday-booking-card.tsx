"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Star,
} from "lucide-react";
import {
  AppointmentStatuses,
  IntakeStatuses,
  SundayFreeRequestStatuses,
} from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatKarachiDateTime, formatKarachiTime } from "@/lib/format/datetime";
import { useTranslations } from "@/i18n/locale-provider";
import { VideoJoinLinkButton } from "@/features/consult/components/video-join-link-button";
import { VideoSessionStatusBanner } from "@/features/consult/components/video-session-status-banner";
import { useVideoJoinWindow } from "@/features/consult/hooks/use-video-join-window";
import { useIntakeStatus } from "@/features/intake/hooks/use-intake-status";
import { SundayMatchingStatus } from "./sunday-matching-status";
import type { SundayPatientBookingDto } from "../types";

type Props = {
  booking: SundayPatientBookingDto;
  variant?: "dashboard" | "profile";
};

function DoctorAvatar({ name, src }: { name: string; src?: string }) {
  if (src) {
    return (
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-2 ring-white/30">
        <Image src={src} alt={name} fill className="object-cover object-top" sizes="56px" />
      </span>
    );
  }

  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-sm font-semibold ring-2 ring-white/30">
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

export function PatientSundayBookingCard({ booking, variant = "dashboard" }: Props) {
  const t = useTranslations();
  const b = t.dashboard.sundayBooking;
  const { doctor } = booking;
  const isMatching =
    booking.requestStatus === SundayFreeRequestStatuses.REQUESTED || !doctor.doctorId;
  const intakeStatus = useIntakeStatus(isMatching ? undefined : booking.appointmentId);
  const { canJoin, joinClosesAt } = useVideoJoinWindow(
    booking.scheduledStart,
    booking.scheduledEnd,
  );
  const isMissed =
    !isMatching &&
    booking.status === AppointmentStatuses.CONFIRMED &&
    !canJoin &&
    Date.now() > joinClosesAt.getTime();

  const statusLabel = isMatching
    ? t.sunday.matchingTitle
    : isMissed
      ? t.dashboard.appointmentHistory.missed
      : booking.status === AppointmentStatuses.CONFIRMED
        ? b.statusConfirmed
        : booking.status === AppointmentStatuses.IN_PROGRESS
          ? b.statusInProgress
          : b.statusPending;

  const isProfile = variant === "profile";

  if (isMatching) {
    return (
      <div className={isProfile ? "space-y-3 p-4 sm:p-5" : "space-y-3"}>
        {isProfile && (
          <div className="mb-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark">{b.title}</p>
          </div>
        )}
        <SundayMatchingStatus showTitle />
        <Button variant="outline" asChild>
          <Link href={`${siteConfig.links.sundayConsult}#request`}>{b.viewOnSundayPage}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={
        isProfile
          ? "overflow-hidden rounded-2xl border border-brand-light/40 bg-gradient-to-br from-brand-muted/90 via-white to-brand-muted/40 shadow-sm"
          : "space-y-4"
      }
    >
      {isProfile && (
        <div className="border-b border-brand-light/30 bg-brand/5 px-4 py-3 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark">{b.title}</p>
          <p className="mt-0.5 text-sm text-slate-600">{b.subtitle}</p>
        </div>
      )}

      <div className={isProfile ? "space-y-4 p-4 sm:p-5" : "space-y-4"}>
        <div className="flex items-start gap-4">
          <DoctorAvatar name={doctor.name} src={doctor.avatarUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display text-base font-semibold text-foreground sm:text-lg">
                  {doctor.name}
                </p>
                <p className="text-sm text-brand/90">{doctor.specialty}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {doctor.pmdcVerified && (
                  <Badge
                    variant="secondary"
                    className="gap-1 border-brand-light/50 bg-brand-muted text-xs text-brand-muted-foreground"
                  >
                    <BadgeCheck className="h-3 w-3" />
                    {t.common.pmdc}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={
                    isMissed
                      ? "border-red-200 bg-red-50 text-xs uppercase tracking-wide text-red-700"
                      : "text-xs"
                  }
                >
                  {statusLabel}
                </Badge>
              </div>
            </div>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {doctor.ratingAvg} ({doctor.ratingCount})
            </p>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-white/80 p-3">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {b.dateTime}
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">
                {formatKarachiDateTime(booking.scheduledStart)}
              </dd>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-white/80 p-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {b.duration}
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">
                {formatKarachiTime(booking.scheduledStart)} – {formatKarachiTime(booking.scheduledEnd)}
              </dd>
              <dd className="mt-0.5 text-xs text-slate-500">{t.sunday.modality}</dd>
            </div>
          </div>
        </dl>

        <VideoSessionStatusBanner
          scheduledStart={booking.scheduledStart}
          scheduledEnd={booking.scheduledEnd}
          appointmentStatus={booking.status}
        />

        {intakeStatus && intakeStatus !== IntakeStatuses.COMPLETED && (
          <Link
            href={`/intake/${booking.appointmentId}`}
            className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100/80"
          >
            <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
            {t.intake.ctaPending}
          </Link>
        )}
        {intakeStatus === IntakeStatuses.COMPLETED && (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            {t.intake.ctaCompleted}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <VideoJoinLinkButton
            appointmentId={booking.appointmentId}
            scheduledStart={booking.scheduledStart}
            scheduledEnd={booking.scheduledEnd}
            label={b.joinSession}
            className="gap-1.5"
            iconClassName="h-4 w-4"
          />
          <Button variant="outline" asChild>
            <Link href={siteConfig.links.sundayConsult}>{b.viewOnSundayPage}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
