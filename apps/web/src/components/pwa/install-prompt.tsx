"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@zindagi/shared";

const DISMISS_KEY = "pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DISMISS_KEY) === "1";
}

export function InstallPrompt() {
  const t = useTranslations();
  const { status } = useSession();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    if (typeof window === "undefined" || isStandalone() || readDismissed()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const iosHint = isIosSafari() && !deferredPrompt;
  const visible =
    status === "authenticated" &&
    !isStandalone() &&
    !dismissed &&
    Boolean(deferredPrompt || isIosSafari());

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setDeferredPrompt(null);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      setDismissed(true);
    } else {
      dismiss();
    }
  }, [deferredPrompt, dismiss]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white p-4 shadow-lg",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
      )}
      role="dialog"
      aria-labelledby="pwa-install-title"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          {iosHint ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p id="pwa-install-title" className="font-semibold text-foreground">
            {t.pwa.installTitle}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {iosHint ? t.pwa.iosInstallHint : t.pwa.installDescription}
          </p>
          {!iosHint && deferredPrompt ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={install}>
                {t.pwa.installAction}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                {t.pwa.installDismiss}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="mt-3" onClick={dismiss}>
              {t.pwa.installDismiss}
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-muted"
          aria-label={t.pwa.installDismiss}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
