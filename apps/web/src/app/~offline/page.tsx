"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLogo } from "@/components/layout/site-logo";
import { useTranslations } from "@/i18n/locale-provider";
import { getWhatsAppSupportUrl } from "@/lib/support-contact";

export default function OfflinePage() {
  const t = useTranslations();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted px-6 py-12 text-center">
      <SiteLogo className="mb-8 h-10" />
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
          <WifiOff className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-foreground">{t.pwa.offlineTitle}</h1>
        <p className="text-sm text-slate-600">{t.pwa.offlineDescription}</p>
        <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" onClick={() => window.location.reload()}>
            {t.pwa.offlineRetry}
          </Button>
          <Button variant="outline" asChild>
            <Link href={getWhatsAppSupportUrl(t.common.whatsappPrefill)} target="_blank">
              {t.pwa.offlineSupport}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
