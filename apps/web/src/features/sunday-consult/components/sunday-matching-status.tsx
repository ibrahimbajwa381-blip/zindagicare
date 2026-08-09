"use client";

import { Phone } from "lucide-react";
import { siteConfig } from "@/config/site";
import { useTranslations } from "@/i18n/locale-provider";

type SundayMatchingStatusProps = {
  /** When true, also renders the title (dashboard/profile cards). */
  showTitle?: boolean;
};

export function SundayMatchingStatus({ showTitle = false }: SundayMatchingStatusProps) {
  const { sunday } = useTranslations();

  return (
    <div className="space-y-3">
      {showTitle && (
        <p className="font-display text-base font-semibold text-foreground">
          {sunday.matchingTitle}
        </p>
      )}
      <p className="text-sm font-medium text-brand-dark">{sunday.matchingMessage}</p>
      <p className="text-sm text-slate-600">{sunday.matchingHint}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {siteConfig.supportPhones.map((phone) => (
          <a
            key={phone.tel}
            href={`tel:${phone.tel}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-light/50 bg-white px-4 py-2.5 text-sm font-semibold text-brand-dark shadow-sm transition-colors hover:bg-brand-muted"
          >
            <Phone className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            {phone.display}
          </a>
        ))}
      </div>
    </div>
  );
}
