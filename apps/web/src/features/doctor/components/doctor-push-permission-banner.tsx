"use client";

import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalStorageFlag } from "@/hooks/use-local-storage-flag";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@zindagi/shared";

const DISMISS_KEY = "doctor-push-dismissed";

export function DoctorPushPermissionBanner() {
  const t = useTranslations();
  const { supported, permission, subscribed, loading, error, subscribe } =
    usePushSubscription();
  const [dismissed, setDismissed] = useLocalStorageFlag(DISMISS_KEY);

  if (!supported || dismissed || permission === "granted" || subscribed) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-4 sm:flex-row sm:items-start",
      )}
      role="region"
      aria-label={t.pwa.pushTitle}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
        {permission === "denied" ? (
          <BellOff className="h-5 w-5" aria-hidden />
        ) : (
          <Bell className="h-5 w-5" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{t.pwa.pushTitle}</p>
        <p className="mt-1 text-sm text-slate-600">
          {permission === "denied" ? t.pwa.pushDenied : t.pwa.pushDescription}
        </p>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        {permission !== "denied" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" loading={loading} onClick={() => subscribe()}>
              {t.pwa.pushEnable}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t.pwa.pushDismiss}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="mt-3" onClick={dismiss}>
            {t.pwa.pushDismiss}
          </Button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 self-start rounded-lg p-1 text-slate-500 hover:bg-white/60"
        aria-label={t.pwa.pushDismiss}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
