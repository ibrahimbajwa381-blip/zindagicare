"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Calendar, Clock, FileText, Video, Zap } from "lucide-react";
import { UrgentCareRequestStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { useTranslations } from "@/i18n/locale-provider";
import { VideoJoinLinkButton } from "@/features/consult/components/video-join-link-button";
import type { UrgentPatientRequestDto } from "../types";

type Props = {
  request: UrgentPatientRequestDto;
  variant?: "dashboard" | "profile" | "page";
  /** When true, parent renders the matching banner (urgent-care page). */
  hideMatchingBanner?: boolean;
};

function DoctorAvatar({ name, src }: { name: string; src?: string }) {
  if (src) {
    return (
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-2 ring-brand-light/40">
        <Image src={src} alt={name} fill className="object-cover object-top" sizes="56px" />
      </span>
    );
  }

  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-muted text-sm font-semibold text-brand-dark ring-2 ring-brand-light/40">
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

export function PatientUrgentRequestCard({
  request,
  variant = "dashboard",
  hideMatchingBanner = false,
}: Props) {
  const t = useTranslations();
  const b = t.urgentCare.booking;
  const isProfile = variant === "profile" || variant === "page";

  const isCompleted = request.status === UrgentCareRequestStatuses.COMPLETED;

  const statusLabel =
    isCompleted
      ? b.statusCompleted
      : request.status === UrgentCareRequestStatuses.ASSIGNED
        ? b.statusAssigned
        : request.status === UrgentCareRequestStatuses.REQUESTED
          ? b.statusRequested
          : request.status;

  const statusMessage = isCompleted
    ? b.completedMessage
    : request.status === UrgentCareRequestStatuses.ASSIGNED
      ? request.doctor
        ? b.assignedMessage.replace("{name}", request.doctor.name)
        : b.assignedMessage.replace("{name}", "Your doctor")
      : b.requestedMessage;

  const canJoin =
    !isCompleted &&
    request.status === UrgentCareRequestStatuses.ASSIGNED &&
    request.appointmentId;

  const joinStart =
    request.scheduledStart ?? request.assignedAt ?? request.createdAt;
  const joinEnd =
    request.scheduledEnd ??
    new Date(new Date(joinStart).getTime() + 10 * 60_000).toISOString();

  return (
    <div
      className={
        isProfile
          ? "overflow-hidden rounded-2xl border border-brand-light/40 bg-gradient-to-br from-brand-muted/90 via-white to-accent-muted/30 shadow-sm"
          : "space-y-4"
      }
    >
      {isProfile && (
        <div className="border-b border-brand-light/30 bg-brand/5 px-4 py-3 sm:px-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-dark">
            <Zap className="h-3.5 w-3.5" />
            {b.title}
          </p>
          {request.doctor ? (
            <p className="mt-0.5 text-sm text-slate-600">{statusMessage}</p>
          ) : null}
        </div>
      )}

      <div className={isProfile ? "space-y-4 p-4 sm:p-5" : "space-y-4"}>
        {request.doctor && (
          <div className="flex items-start gap-4">
            <DoctorAvatar name={request.doctor.name} src={request.doctor.avatarUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-base font-semibold text-foreground sm:text-lg">
                    {request.doctor.name}
                  </p>
                  <p className="text-sm text-brand/90">{request.doctor.specialty}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {request.doctor.pmdcVerified && (
                    <Badge
                      variant="secondary"
                      className="gap-1 border-brand-light/50 bg-brand-muted text-xs text-brand-muted-foreground"
                    >
                      <BadgeCheck className="h-3 w-3" />
                      {t.common.pmdc}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {statusLabel}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {!request.doctor && !hideMatchingBanner && (
          <div className="rounded-xl border-2 border-brand/30 bg-brand-muted/50 px-5 py-5 text-center">
            <p className="font-display text-lg font-bold text-brand-dark sm:text-xl">{b.matchingTitle}</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700 sm:text-base">
              {b.matchingBody}
            </p>
          </div>
        )}

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-white/80 p-3">
            <Video className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {b.consultType}
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{b.videoConsultLabel}</dd>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-white/80 p-3">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {b.requestedAt}
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">
                {formatKarachiDateTime(request.createdAt)}
              </dd>
            </div>
          </div>
        </dl>

        {request.status === UrgentCareRequestStatuses.ASSIGNED && request.assignedAt && (
          <div className="flex gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3 text-sm text-emerald-900">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{b.expectVideoSoon}</p>
          </div>
        )}

        {isCompleted && (
          <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm text-slate-800">
            <Video className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>{b.consultEnded}</p>
          </div>
        )}

        {request.patientNotes && (
          <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {b.symptomsSummary}
            </p>
            <p className="mt-1 text-slate-700">{request.patientNotes}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {canJoin ? (
            <VideoJoinLinkButton
              urgent
              appointmentId={request.appointmentId!}
              scheduledStart={joinStart}
              scheduledEnd={joinEnd}
              label={b.joinVideo}
              className="gap-1.5 bg-brand hover:bg-brand-dark"
              iconClassName="h-4 w-4"
            />
          ) : request.status === UrgentCareRequestStatuses.ASSIGNED ? (
            <p className="text-sm text-amber-800">{b.videoSessionPreparing}</p>
          ) : null}
          {isCompleted && request.prescription ? (
            <Button asChild className="gap-1.5 bg-brand hover:bg-brand-dark">
              <a
                href={request.prescription.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="h-4 w-4" />
                {b.viewPrescription}
              </a>
            </Button>
          ) : null}
          {!isCompleted ? (
            <Button variant="outline" asChild>
              <Link href={siteConfig.links.urgentCare}>{b.viewUrgentPage}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** @deprecated use PatientUrgentRequestCard */
export const PatientUrgentBookingCard = PatientUrgentRequestCard;
