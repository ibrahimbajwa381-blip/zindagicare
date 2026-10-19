"use client";

import { PhoneCall } from "lucide-react";
import { cn } from "@zindagi/shared";
import { useTranslations } from "@/i18n/locale-provider";

export function EmergencyNotice({ className }: { className?: string }) {
  const t = useTranslations().medicalQa;
  return (
    <div
      role="note"
      className={cn("flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900", className)}
    >
      <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
      <p>
        <span className="font-semibold">{t.emergencyTitle}</span> {t.emergencyBody}
      </p>
    </div>
  );
}
