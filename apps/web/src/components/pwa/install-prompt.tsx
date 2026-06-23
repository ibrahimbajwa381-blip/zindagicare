"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Download, Monitor, Share2, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { useMounted } from "@/hooks/use-mounted";
import { useTranslations } from "@/i18n/locale-provider";
import {
  detectAppPlatform,
  getAppInstallUrl,
  isStandalonePwa,
  type AppPlatform,
} from "@/lib/pwa/platform";
import { surfaceCard } from "@/lib/ui/surfaces";
import { cn } from "@zindagi/shared";

const DISMISS_KEY = "pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DISMISS_KEY) === "1";
}

function isMobilePlatform(platform: AppPlatform): boolean {
  return platform === "ios" || platform === "android";
}

export function InstallPrompt() {
  const t = useTranslations();
  const { status } = useSession();
  const pathname = usePathname();
  const mounted = useMounted();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);

  const platform = mounted ? detectAppPlatform() : ("unknown" as AppPlatform);
  const isMobile = isMobilePlatform(platform);
  const iosHint = platform === "ios" && !deferredPrompt;
  const canNativeInstall = Boolean(deferredPrompt);

  const shouldOffer =
    mounted &&
    status === "authenticated" &&
    !isStandalonePwa() &&
    !readDismissed() &&
    !dismissed &&
    pathname !== siteConfig.links.getApp &&
    platform !== "unknown";

  const open = shouldOffer;

  useEffect(() => {
    if (typeof window === "undefined" || isStandalonePwa() || readDismissed()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

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

  if (!open) return null;

  const title = isMobile ? t.pwa.promptTitleMobile : t.pwa.promptTitleDesktop;
  const description = isMobile ? t.pwa.promptDescriptionMobile : t.pwa.promptDescriptionDesktop;
  const hint = iosHint
    ? t.pwa.iosInstallHint
    : isMobile
      ? t.pwa.promptMobileHint
      : canNativeInstall
        ? t.pwa.promptDesktopInstallHint
        : t.pwa.promptDesktopHint;
  const guideUrl = getAppInstallUrl(platform);
  const PlatformIcon = isMobile ? Smartphone : Monitor;
  const headerBand = isMobile
    ? "from-brand/15 to-brand-light/5"
    : "from-accent-muted/80 to-brand-muted/40";

  return (
    <dialog
      ref={dialogRef}
      className="pwa-install-dialog fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-900/55 backdrop:backdrop-blur-sm"
      onClose={dismiss}
      onClick={(e) => {
        if (e.target === dialogRef.current) dismiss();
      }}
      aria-labelledby="pwa-install-title"
    >
      <div className="flex h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-t-3xl shadow-premium-lg sm:max-w-md sm:rounded-3xl",
            surfaceCard,
          )}
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          <div className={cn("relative bg-gradient-to-b px-6 pb-6 pt-7", headerBand)}>
            <button
              type="button"
              onClick={dismiss}
              className="absolute top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-500 transition-colors hover:bg-white hover:text-slate-800 active:scale-95 ltr:right-4 rtl:left-4"
              aria-label={t.common.closeMenu}
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl shadow-sm ring-2 ring-white/80">
                <Image
                  src={siteConfig.icon}
                  alt=""
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <div className="min-w-0 pt-1">
                <span
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-xl",
                    isMobile ? "bg-brand/10 text-brand" : "bg-accent/10 text-accent",
                  )}
                >
                  <PlatformIcon className="h-5 w-5" aria-hidden />
                </span>
                <h2
                  id="pwa-install-title"
                  className="mt-3 font-display text-xl font-semibold text-foreground sm:text-2xl"
                >
                  {title}
                </h2>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{description}</p>

            <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
              <p className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600">
                {iosHint ? (
                  <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                ) : canNativeInstall ? (
                  <Download className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                ) : (
                  <PlatformIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                )}
                <span>{hint}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row">
            {canNativeInstall ? (
              <Button
                type="button"
                className="flex-1 bg-brand text-white hover:bg-brand-dark"
                onClick={install}
              >
                <Download className="h-4 w-4" aria-hidden />
                {isMobile ? t.pwa.installAction : t.pwa.promptDesktopAction}
              </Button>
            ) : (
              <Button
                asChild
                className="flex-1 bg-brand text-white hover:bg-brand-dark"
                onClick={dismiss}
              >
                <Link href={guideUrl}>{t.pwa.promptViewGuide}</Link>
              </Button>
            )}
            <Button type="button" variant="outline" className="flex-1" onClick={dismiss}>
              {t.pwa.promptContinueBrowser}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
