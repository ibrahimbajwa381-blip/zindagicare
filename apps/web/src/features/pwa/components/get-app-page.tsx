"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Download, Share2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import {
  detectAppPlatform,
  getShareableAppUrl,
  isStandalonePwa,
  type AppPlatform,
} from "@/lib/pwa/platform";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@zindagi/shared";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PlatformSectionProps = {
  id: AppPlatform;
  title: string;
  steps: readonly string[];
  highlighted: boolean;
  sectionRef: React.RefObject<HTMLElement | null>;
  children?: React.ReactNode;
};

function PlatformSection({
  id,
  title,
  steps,
  highlighted,
  sectionRef,
  children,
}: PlatformSectionProps) {
  return (
    <section
      id={id}
      ref={sectionRef}
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-white p-6 shadow-sm transition-colors sm:p-8",
        highlighted ? "border-brand ring-2 ring-brand/20" : "border-border",
      )}
    >
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-relaxed text-slate-600">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

export function GetAppPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const platformParam = searchParams.get("platform");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  const androidRef = useRef<HTMLElement>(null);
  const iosRef = useRef<HTMLElement>(null);

  const shareUrl = useMemo(
    () => getShareableAppUrl(siteConfig.url.replace(/\/$/, "")),
    [],
  );

  const detectedPlatform = mounted ? detectAppPlatform() : ("unknown" as AppPlatform);
  const highlightedPlatform: AppPlatform =
    platformParam === "android" || platformParam === "ios"
      ? platformParam
      : detectedPlatform === "android" || detectedPlatform === "ios"
        ? detectedPlatform
        : "android";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || isStandalonePwa()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const target =
      highlightedPlatform === "ios"
        ? iosRef.current
        : highlightedPlatform === "android"
          ? androidRef.current
          : null;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mounted, highlightedPlatform]);

  const copyShareLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t.pwa.copyLinkPrompt, shareUrl);
    }
  }, [shareUrl, t.pwa.copyLinkPrompt]);

  const installAndroid = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const standalone = mounted && isStandalonePwa();

  return (
    <div className="bg-muted/40">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white p-2 shadow-sm ring-1 ring-border">
            <Image
              src={siteConfig.icon}
              alt={siteConfig.name}
              width={64}
              height={64}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t.pwa.getAppTitle}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            {t.pwa.getAppDescription}
          </p>
        </div>

        {standalone ? (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center text-sm text-emerald-900">
            <Check className="mx-auto mb-2 h-5 w-5" aria-hidden />
            {t.pwa.alreadyInstalled}
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-foreground">{t.pwa.shareLinkTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{t.pwa.shareLinkDescription}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-border bg-muted px-3 py-2.5 text-xs text-slate-700 sm:text-sm">
              {shareUrl}
            </code>
            <Button type="button" variant="outline" className="shrink-0" onClick={copyShareLink}>
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  {t.pwa.linkCopied}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden />
                  {t.pwa.copyLink}
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6">
          <PlatformSection
            id="android"
            title={t.pwa.androidTitle}
            steps={t.pwa.androidSteps}
            highlighted={highlightedPlatform === "android"}
            sectionRef={androidRef}
          >
            {deferredPrompt ? (
              <Button type="button" onClick={installAndroid}>
                <Download className="h-4 w-4" aria-hidden />
                {t.pwa.installAction}
              </Button>
            ) : (
              <p className="text-xs text-slate-500">{t.pwa.androidChromeHint}</p>
            )}
          </PlatformSection>

          <PlatformSection
            id="ios"
            title={t.pwa.iosTitle}
            steps={t.pwa.iosSteps}
            highlighted={highlightedPlatform === "ios"}
            sectionRef={iosRef}
          >
            <p className="inline-flex items-center gap-2 text-xs text-slate-500">
              <Share2 className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              {t.pwa.iosSafariHint}
            </p>
          </PlatformSection>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 text-center text-sm text-slate-500">
          <Smartphone className="h-5 w-5 text-brand" aria-hidden />
          <p>{t.pwa.getAppFooterHint}</p>
          <Link href="/" className="font-medium text-brand hover:text-brand-dark">
            {t.pwa.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
