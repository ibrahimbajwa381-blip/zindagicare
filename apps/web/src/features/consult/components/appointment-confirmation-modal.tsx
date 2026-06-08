"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, Clock, X } from "lucide-react";
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
      <div className="flex h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className={`flex w-full flex-col overflow-hidden rounded-t-3xl shadow-premium-lg sm:max-w-md sm:rounded-3xl ${surfaceCard}`}
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          <div className="relative px-6 pb-2 pt-8 text-center">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 active:scale-95"
              aria-label={t.common.closeMenu}
            >
              <X className="h-5 w-5" />
            </button>

            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold text-foreground sm:text-2xl">
              {copy.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-brand-light/30 bg-brand-muted/40 px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {copy.doctor}
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-foreground">
                {details.doctorName}
              </p>
              {details.doctorSpecialty && (
                <p className="mt-0.5 text-sm text-brand/90">{details.doctorSpecialty}</p>
              )}
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-white/80 p-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {copy.dateTime}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">
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
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row">
            <Button
              asChild
              className="flex-1 bg-brand text-white hover:bg-brand-dark"
              onClick={() => onOpenChange(false)}
            >
              <Link href={siteConfig.links.dashboard}>{copy.viewDashboard}</Link>
            </Button>
            <Button
              variant="outline"
              className="flex-1"
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
