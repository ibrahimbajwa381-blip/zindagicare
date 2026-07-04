"use client";

import Link from "next/link";
import { Calendar, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookedAppointmentPayload } from "@zindagi/validators";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { surfaceCard } from "@/lib/ui/surfaces";

type CopilotBookedCardProps = {
  booking: BookedAppointmentPayload;
  confirmedTitle: string;
  pendingTitle: string;
  pendingDescription: string;
  payNowLabel: string;
  viewDashboardLabel: string;
  onPay?: () => void;
};

export function CopilotBookedCard({
  booking,
  confirmedTitle,
  pendingTitle,
  pendingDescription,
  payNowLabel,
  viewDashboardLabel,
  onPay,
}: CopilotBookedCardProps) {
  const isConfirmed = booking.status === "confirmed";

  return (
    <div
      className={`mt-3 ${surfaceCard} border p-3 ${
        isConfirmed ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <div className="flex items-start gap-2">
        <CheckCircle2
          className={`mt-0.5 h-5 w-5 shrink-0 ${isConfirmed ? "text-emerald-600" : "text-amber-600"}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">
            {isConfirmed ? confirmedTitle : pendingTitle}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">{booking.doctorName}</p>
          <p className="text-xs text-slate-600">{booking.specialty}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
            <Calendar className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span>{formatKarachiDateTime(booking.scheduledStart)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Rs. {booking.consultationFee.toLocaleString()}
          </p>
          {!isConfirmed ? (
            <p className="mt-2 text-xs text-amber-800">{pendingDescription}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {!isConfirmed && onPay ? (
              <Button type="button" size="sm" className="rounded-full px-4" onClick={onPay}>
                {payNowLabel}
              </Button>
            ) : null}
            {isConfirmed && booking.dashboardHref ? (
              <Button asChild size="sm">
                <Link href={booking.dashboardHref}>{viewDashboardLabel}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
