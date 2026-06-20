"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Phone, Zap } from "lucide-react";
import { siteConfig } from "@/config/site";
import { URGENT_CARE_HERO_IMAGE, URGENT_CARE_HERO_IMAGE_CLASS } from "@/features/marketing/data/hero-services";
import { useTranslations } from "@/i18n/locale-provider";
import { URGENT_CONSULT_CONFIG } from "@zindagi/shared";

export function HeroUrgentCareStrip() {
  const t = useTranslations();
  const u = t.urgentCare;

  return (
    <Link
      href={`${siteConfig.links.urgentCare}#request`}
      className="group relative flex overflow-hidden rounded-2xl border border-white/10 bg-banner-brand shadow-premium transition-shadow hover:shadow-premium-lg sm:rounded-3xl"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-accent/25 blur-3xl"
      />

      <div className="relative flex min-w-0 flex-1 flex-col justify-center px-4 py-4 sm:px-6 sm:py-5">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-50 sm:text-xs">
          <Zap className="h-3.5 w-3.5 shrink-0 text-amber-200" aria-hidden />
          {u.shortName}
          <span className="rounded-full border border-amber-200/50 bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-950 sm:text-[11px]">
            {t.nav.urgentBadge}
          </span>
        </p>
        <p className="mt-1.5 font-display text-lg font-bold leading-tight text-white drop-shadow-sm sm:text-xl">
          {u.heroHeadline}{" "}
          <span className="text-amber-200">{u.heroHeadlineHighlight}</span>
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-white sm:text-sm">{u.heroStripTagline}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-emerald-50 sm:text-xs">
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3.5 w-3.5 text-amber-200" aria-hidden />
            {u.heroStripCtaHint}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-amber-200" aria-hidden />
            {u.waitBadge
              .replace("{min}", String(URGENT_CONSULT_CONFIG.minWaitMinutes))
              .replace("{max}", String(URGENT_CONSULT_CONFIG.maxWaitMinutes))}
          </span>
        </div>
      </div>

      <div className="relative hidden w-[9.5rem] shrink-0 sm:block md:w-[11rem] lg:w-[12.5rem]">
        <Image
          src={URGENT_CARE_HERO_IMAGE}
          alt=""
          fill
          sizes="200px"
          className={`object-cover ${URGENT_CARE_HERO_IMAGE_CLASS}`}
          aria-hidden
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-brand via-brand/40 to-transparent"
        />
      </div>

      <span className="flex shrink-0 items-center px-3 text-white transition-transform group-hover:translate-x-0.5 sm:px-4">
        <ArrowRight className="h-5 w-5" aria-hidden />
      </span>
    </Link>
  );
}
