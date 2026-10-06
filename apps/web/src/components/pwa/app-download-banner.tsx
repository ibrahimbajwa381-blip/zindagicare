"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Smartphone } from "lucide-react";
import { siteConfig } from "@/config/site";
import { isStandalonePwa } from "@/lib/pwa/platform";
import { useMounted } from "@/hooks/use-mounted";
import { useTranslations } from "@/i18n/locale-provider";
import { useEffect, useState } from "react";

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.42 2.09-1.24 2.86-.9.84-1.96 1.25-3.13 1.18-.04-1.09.4-2.08 1.26-2.87.86-.8 2.02-1.24 3.11-1.17zM20.8 17.13c-.55 1.27-.82 1.84-1.54 2.97-1 1.54-2.41 3.47-4.16 3.48-1.56.01-1.96-1.01-4.08-1.01-2.12 0-2.57 1-4.13 1.02-1.76.01-3.2-1.98-4.2-3.52-2.88-4.41-3.18-9.58-1.4-12.32 1.26-1.92 3.25-3.04 5.13-3.04 1.91 0 3.11 1.02 4.69 1.02 1.53 0 2.46-1.02 4.65-1.02 1.66 0 3.42.9 4.68 2.46-4.11 2.24-3.44 8.07.76 9.98z" />
    </svg>
  );
}

export function AppDownloadBanner() {
  const t = useTranslations();
  const pathname = usePathname();
  const mounted = useMounted();
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandalonePwa());
  }, []);

  if (!mounted || standalone || pathname === siteConfig.links.getApp) {
    return null;
  }

  return (
    <section
      aria-labelledby="app-download-banner-title"
      className="relative overflow-hidden border-b border-brand/20 bg-gradient-to-br from-[#062a5c] via-[#0a3d6e] to-[#0FA79B]"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 45%), radial-gradient(circle at 80% 20%, rgba(15,167,155,0.4) 0%, transparent 40%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-[100rem] flex-col gap-8 px-4 py-10 sm:px-8 sm:py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-14 lg:py-14">
        <div className="flex min-w-0 flex-1 items-start gap-5 sm:gap-6">
          <div className="relative shrink-0">
            <Image
              src={siteConfig.icon}
              alt=""
              width={80}
              height={80}
              className="relative h-16 w-16 rounded-2xl bg-white object-contain p-1.5 shadow-lg ring-2 ring-white/40 sm:h-20 sm:w-20 sm:p-2"
            />
          </div>

          <div className="min-w-0 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              <Smartphone className="h-3.5 w-3.5" aria-hidden />
              {t.pwa.downloadBannerBadge}
            </span>
            <h2
              id="app-download-banner-title"
              className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl"
            >
              {t.pwa.downloadBannerTitle}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
              {t.pwa.downloadBannerSubtitle}
            </p>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row lg:w-auto lg:flex-col xl:flex-row">
          <Link
            href={siteConfig.links.getAppAndroid}
            className="group inline-flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-left shadow-lg transition hover:bg-white/95 hover:shadow-xl sm:min-w-[220px] lg:min-w-[240px]"
          >
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
              <Image
                src="/icons/android.webp"
                alt=""
                width={44}
                height={44}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
                {t.pwa.downloadBannerPlatformAndroid}
              </span>
              <span className="block text-sm font-semibold text-slate-900 sm:text-base">
                {t.pwa.downloadBannerAndroid}
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-brand transition group-hover:translate-x-0.5" />
          </Link>

          <Link
            href={siteConfig.links.getAppIos}
            className="group inline-flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl border-2 border-white/30 bg-white/15 px-5 py-3.5 text-left transition hover:border-white/50 hover:bg-white/20 sm:min-w-[220px] lg:min-w-[240px]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
              <AppleIcon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-white/70">
                {t.pwa.downloadBannerPlatformIos}
              </span>
              <span className="block text-sm font-semibold text-white sm:text-base">
                {t.pwa.downloadBannerIos}
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-white/90 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
