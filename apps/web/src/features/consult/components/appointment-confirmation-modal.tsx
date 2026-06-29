"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, ClipboardList, Clock, X } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatKarachiDateTime, formatKarachiTime } from "@/lib/format/datetime";
import { useTranslations } from "@/i18n/locale-provider";
import { surfaceCard } from "@/lib/ui/surfaces";

export type AppointmentConfirmationDetails = {
  doctorName: string;
  doctorSpecialty?: string;
  scheduledStart: string;
  scheduledEnd: string;
  consultationFee?: number;
  type?: "sunday" | "online";
  /** Enables the "complete your medical history" CTA for Sunday bookings. */
  appointmentId?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: AppointmentConfirmationDetails | null;
};

export function AppointmentConfirmationModal({ open, onOpenChange, details }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const t = useTranslations();
  const copy = t.dashboard.appointmentConfirmation;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
    } else {
      if (dialog.open) dialog.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!details) return null;

  const isSunday = details.type === "sunday";

  return (
    <dialog
      ref={dialogRef}
      className="appointment-confirmation-dialog fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-900/50"
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
    >
      <div className="flex h-full min-h-0 items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className={cn(
            "flex max-h-[min(92dvh,100%)] w-full flex-col overflow-hidden rounded-t-3xl shadow-premium-lg sm:max-h-[90dvh] sm:max-w-md sm:rounded-3xl",
            surfaceCard,
          )}
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="relative px-4 pb-2 pt-6 text-center sm:px-6 sm:pt-8">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 active:scale-95 sm:right-4 sm:top-4 sm:h-10 sm:w-10"
              aria-label={t.common.closeMenu}
            >
              <X className="h-5 w-5" />
            </button>

            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 sm:h-14 sm:w-14">
              <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
            </span>
            <h2 className="mt-3 font-display text-lg font-semibold text-foreground sm:mt-4 sm:text-xl md:text-2xl">
              {copy.title}
            </h2>
            <p className="mt-2 px-1 text-sm text-slate-600">{copy.subtitle}</p>
          </div>

          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            <div className="rounded-xl border border-brand-light/30 bg-brand-muted/40 px-3 py-3 text-center sm:px-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {copy.doctor}
              </p>
              <p className="mt-1 break-words font-display text-base font-semibold text-foreground sm:text-lg">
                {details.doctorName}
              </p>
              {details.doctorSpecialty && (
                <p className="mt-0.5 text-sm text-brand/90">{details.doctorSpecialty}</p>
              )}
            </div>

            <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-white/80 p-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {copy.dateTime}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium text-slate-800">
                    {formatKarachiDateTime(details.scheduledStart)}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-white/80 p-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {copy.slot}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">
                    {formatKarachiTime(details.scheduledStart)} –{" "}
                    {formatKarachiTime(details.scheduledEnd)}
                  </dd>
                  <dd className="mt-0.5 text-xs text-slate-500">
                    {isSunday ? t.sunday.modality : copy.videoConsult}
                  </dd>
                </div>
              </div>
            </dl>

            {details.consultationFee != null && (
              <p className="text-center text-sm text-slate-600">
                {copy.feePaid}{" "}
                <span className="font-semibold text-brand-dark">
                  Rs. {details.consultationFee.toLocaleString()}
                </span>
              </p>
            )}

            <p className="text-center text-xs text-slate-500">{copy.reminder}</p>

            {details.appointmentId && (
              <div className="rounded-2xl border border-brand-light/40 bg-gradient-to-br from-brand-muted/60 via-white to-accent-muted/30 p-4 text-left">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
                    <ClipboardList className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {t.intake.wizard.heroTagline}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {t.intake.wizard.heroSubtitle}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:px-6 sm:py-4">
            {details.appointmentId ? (
              <Button
                asChild
                className="h-auto min-h-11 w-full whitespace-normal bg-brand px-3 py-2.5 text-center leading-snug text-white hover:bg-brand-dark sm:flex-1"
                onClick={() => onOpenChange(false)}
              >
                <Link href={`/intake/${details.appointmentId}`}>
                  {t.intake.ctaPending}
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                className="h-auto min-h-11 w-full whitespace-normal bg-brand px-3 py-2.5 text-center leading-snug text-white hover:bg-brand-dark sm:flex-1"
                onClick={() => onOpenChange(false)}
              >
                <Link href={siteConfig.links.dashboard}>{copy.viewDashboard}</Link>
              </Button>
            )}
            <Button
              variant="outline"
              className="h-auto min-h-11 w-full whitespace-normal px-3 py-2.5 leading-snug sm:flex-1"
              onClick={() => onOpenChange(false)}
            >
              {copy.gotIt}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
