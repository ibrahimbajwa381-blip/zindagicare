"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { doctorProfilePath } from "@/lib/doctors/profile-path";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import type { BookingSuggestionPayload } from "@zindagi/validators";

type CopilotBookingCardProps = {
  suggestion: BookingSuggestionPayload;
  bookLabel: string;
  feeLabel: string;
  verifiedLabel: string;
  onBook: () => void;
};

export function CopilotBookingCard({
  suggestion,
  bookLabel,
  feeLabel,
  verifiedLabel,
  onBook,
}: CopilotBookingCardProps) {
  const avatarSrc = resolveDoctorPortrait(suggestion.doctorName, suggestion.doctorAvatarUrl);
  const profileHref = doctorProfilePath(suggestion.doctorSlug, suggestion.doctorId);

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-light/40 bg-white shadow-sm">
      <div className="p-3.5">
      <div className="flex items-start gap-3">
        <Link href={profileHref} className="shrink-0">
          {avatarSrc ? (
            <span className="relative block h-12 w-12 overflow-hidden rounded-xl ring-1 ring-slate-200 transition-opacity hover:opacity-90">
              <Image
                src={avatarSrc}
                alt={suggestion.doctorName}
                fill
                className="object-cover object-top"
                sizes="48px"
                unoptimized
              />
            </span>
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-sm font-semibold text-brand-dark transition-opacity hover:opacity-90">
              {suggestion.doctorName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={profileHref}
            className="font-semibold text-slate-900 hover:text-brand-dark hover:underline"
          >
            {suggestion.doctorName}
          </Link>
          <p className="text-sm text-slate-600">{suggestion.specialty}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {suggestion.pmdcVerified ? (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
                {verifiedLabel}
              </span>
            ) : null}
            {(suggestion.ratingCount ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                {suggestion.ratingAvg?.toFixed(1)} ({suggestion.ratingCount})
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <Calendar className="h-4 w-4 shrink-0 text-brand" aria-hidden />
        <span>{formatKarachiDateTime(suggestion.slotStartAt)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">
          {feeLabel}: Rs. {suggestion.consultationFee.toLocaleString()}
        </p>
        <Button type="button" size="sm" className="shrink-0 rounded-full px-4" onClick={onBook}>
          {bookLabel}
        </Button>
      </div>
      </div>
    </div>
  );
}

type CopilotUrgentCardProps = {
  href: string;
  title: string;
  description: string;
  ctaLabel: string;
};

export function CopilotUrgentCard({ href, title, description, ctaLabel }: CopilotUrgentCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-white p-3.5 shadow-sm">
      <div className="flex items-start gap-2">
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div>
          <p className="font-semibold text-amber-900">{title}</p>
          <p className="mt-1 text-sm text-amber-800">{description}</p>
          <Button asChild size="sm" variant="outline" className="mt-3 border-amber-300 bg-white">
            <Link href={href}>{ctaLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
