"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Phone, Zap } from "lucide-react";
import { siteConfig } from "@/config/site";
import { URGENT_CARE_HERO_IMAGE } from "@/features/marketing/data/hero-services";
import { useTranslations } from "@/i18n/locale-provider";
import { URGENT_CONSULT_CONFIG } from "@zindagi/shared";

export function HeroUrgentCareStrip() {
  const t = useTranslations();
  const u = t.urgentCare;

  return (
    <Link
      href={`${siteConfig.links.urgentCare}#request`}
      className="group relative flex overflow-hidden rounded-2xl border border-brand-light/30 bg-gradient-to-r from-brand-dark via-brand to-brand-dark shadow-premium transition-shadow hover:shadow-premium-lg sm:rounded-3xl"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-brand-lighter/15 blur-3xl"
      />

      <div className="relative flex min-w-0 flex-1 flex-col justify-center px-4 py-4 sm:px-6 sm:py-5">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-lighter/90 sm:text-xs">
          <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {u.shortName}
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white sm:text-[11px]">
            {t.nav.urgentBadge}
          </span>
        </p>
        <p className="mt-1.5 font-display text-lg font-bold leading-tight text-white sm:text-xl">
          {u.heroHeadline}{" "}
          <span className="text-brand-lighter">{u.heroHeadlineHighlight}</span>
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-white/75 sm:text-sm">{u.heroStripTagline}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/80 sm:text-xs">
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3.5 w-3.5 text-brand-lighter" aria-hidden />
            {u.heroStripCtaHint}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-brand-lighter" aria-hidden />
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
          className="object-cover object-center"
          aria-hidden
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-brand via-brand/40 to-transparent"
        />
      </div>

      <span className="flex shrink-0 items-center px-3 text-white/90 transition-transform group-hover:translate-x-0.5 sm:px-4">
        <ArrowRight className="h-5 w-5" aria-hidden />
      </span>
    </Link>
  );
}
