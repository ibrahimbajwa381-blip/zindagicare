"use client";

import Link from "next/link";
import { Calendar, ExternalLink, FileText } from "lucide-react";
import type { CopilotMessageMetadata } from "@zindagi/validators";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { surfaceCard } from "@/lib/ui/surfaces";

type CopilotAuxiliaryCardsProps = {
  metadata: CopilotMessageMetadata;
};

export function CopilotAuxiliaryCards({ metadata }: CopilotAuxiliaryCardsProps) {
  const hasLinks = (metadata.actionLinks?.length ?? 0) > 0;
  const hasAppointments = (metadata.appointmentPreviews?.length ?? 0) > 0;
  const hasPrescriptions = (metadata.prescriptionPreviews?.length ?? 0) > 0;

  if (!hasLinks && !hasAppointments && !hasPrescriptions) return null;

  return (
    <div className="mt-3 space-y-2">
      {hasAppointments ? (
        <div className={`${surfaceCard} border border-slate-200/80 bg-white p-3`}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Upcoming appointments
          </p>
          <ul className="space-y-2">
            {metadata.appointmentPreviews!.map((item) => (
              <li key={item.appointmentId}>
                <Link
                  href={item.href}
                  className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 text-sm transition-colors hover:border-brand-light/60 hover:bg-brand-muted/30"
                >
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <span>
                    <span className="font-medium text-slate-900">{item.doctorName}</span>
                    <span className="block text-xs text-slate-600">
                      {item.specialty} · {formatKarachiDateTime(item.scheduledStart)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasPrescriptions ? (
        <div className={`${surfaceCard} border border-slate-200/80 bg-white p-3`}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Prescriptions
          </p>
          <ul className="space-y-2">
            {metadata.prescriptionPreviews!.map((item) => (
              <li key={item.prescriptionId}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 text-sm transition-colors hover:border-brand-light/60 hover:bg-brand-muted/30"
                >
                  <FileText className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <span className="font-medium text-slate-900">{item.doctorName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasLinks ? (
        <div className="flex flex-wrap gap-2">
          {metadata.actionLinks!.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1 rounded-full border border-brand-light/50 bg-brand-muted/50 px-3 py-1.5 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-muted"
            >
              {link.label}
              <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
