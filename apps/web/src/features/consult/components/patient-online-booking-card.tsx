"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Calendar, Clock, MessageCircle, Star, Video } from "lucide-react";
import { AppointmentStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatKarachiDateTime, formatKarachiTime } from "@/lib/format/datetime";
import { CountdownTimer } from "@/features/sunday-consult/components/countdown-timer";
import type { OnlinePatientBookingDto } from "../types";

type Props = {
  booking: OnlinePatientBookingDto;
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

export function PatientOnlineBookingCard({ booking, variant = "dashboard" }: Props) {
  const { doctor } = booking;
  const isProfile = variant === "profile";

  const statusLabel =
    booking.status === AppointmentStatuses.CONFIRMED
      ? "Confirmed"
      : booking.status === AppointmentStatuses.IN_PROGRESS
        ? "In progress"
        : "Pending";

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
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark">
            Your online consult
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            Paid video consultation — join at your booked time.
          </p>
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
                    PMDC
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {statusLabel}
                </Badge>
              </div>
            </div>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {doctor.ratingAvg} ({doctor.ratingCount})
            </p>
            <p className="mt-1 text-sm font-medium text-brand-dark">
              Paid · Rs. {booking.consultationFee.toLocaleString()}
            </p>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-white/80 p-3">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Date & time
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
                Slot
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">
                {formatKarachiTime(booking.scheduledStart)} – {formatKarachiTime(booking.scheduledEnd)}
              </dd>
              <dd className="mt-0.5 text-xs text-slate-500">Secure video on ZindagiCare</dd>
            </div>
          </div>
        </dl>

        <div className="rounded-xl border border-brand-light/30 bg-brand-muted/50 px-4 py-3">
          <p className="text-xs text-slate-500">Starts in</p>
          <CountdownTimer targetDate={booking.scheduledStart} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild className="gap-1.5">
            <Link href={siteConfig.links.dashboard}>
              <Video className="h-4 w-4" />
              Join video session
            </Link>
          </Button>
          <Button variant="outline" asChild className="gap-1.5">
            <Link href={`${siteConfig.links.messages}?doctor=${doctor.doctorId}`}>
              <MessageCircle className="h-4 w-4" />
              Message doctor
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={siteConfig.links.doctors}>View on doctors page</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
