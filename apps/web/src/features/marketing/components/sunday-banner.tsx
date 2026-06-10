"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, Gift } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import {
  formatNextSundayLong,
  isSundayBookingOpenNow,
} from "@/lib/sunday/display";
import { PageSection } from "@/components/layout/page-section";
import { useTranslations } from "@/i18n/locale-provider";
import { SUNDAY_FREE_CONSULT_HERO_IMAGE } from "@/features/marketing/data/hero-services";

export function SundayBanner() {
  const t = useTranslations();
  const sunday = t.sunday;
  const nextSunday = formatNextSundayLong();
  const bookingOpen = isSundayBookingOpenNow();
  const bookHref = `${siteConfig.links.sundayConsult}#how-it-works`;

  return (
    <PageSection
      id="sunday-free-consult"
      spacing="default"
      innerClassName="py-8 sm:py-12 lg:py-16"
    >
      <div className="overflow-hidden rounded-2xl bg-hero-brand shadow-premium-lg sm:rounded-3xl">
        <div className="relative flex flex-col lg:flex-row">
          <div className="relative h-36 w-full shrink-0 sm:h-44 lg:order-2 lg:h-auto lg:min-h-[20rem] lg:w-[40%] xl:min-h-[22rem]">
            <Image
              src={SUNDAY_FREE_CONSULT_HERO_IMAGE}
              alt="Free Sunday video consultation on ZindagiCare"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover object-center lg:object-[center_35%]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-brand-dark/75 via-brand-dark/15 to-transparent lg:bg-gradient-to-l lg:from-brand-dark/60 lg:via-transparent lg:to-transparent"
            />
          </div>

          <div className="flex flex-1 flex-col justify-center px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-lighter/75 sm:text-xs">
              {sunday.shortName}
            </p>

            <h2 className="mt-2 font-display text-[1.65rem] font-semibold leading-[1.15] tracking-tight text-white sm:mt-3 sm:text-4xl lg:text-[2.75rem]">
              {sunday.heroHeadline}{" "}
              <span className="text-gradient-hero">{sunday.heroHeadlineHighlight}</span>
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">
              {sunday.tagline}
            </p>

            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/90 backdrop-blur-sm sm:text-sm">
              <Gift className="h-4 w-4 shrink-0 text-brand-lighter" />
              <span className="truncate">
                {sunday.priceLabel} · {sunday.durationLabel} · {sunday.onlineOnlyTitle}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm sm:text-sm">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-brand-lighter" />
                {nextSunday}
              </span>
              {bookingOpen && (
                <span className="inline-flex items-center rounded-lg bg-brand-lighter/20 px-2.5 py-1.5 text-xs font-semibold text-brand-lighter sm:text-sm">
                  {t.common.bookingOpen}
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center">
              <Button
                size="lg"
                className="group h-11 w-full rounded-xl bg-white px-6 text-sm font-semibold text-brand-dark shadow-premium hover:bg-brand-muted sm:h-12 sm:w-auto sm:text-base"
                asChild
              >
                <Link href={bookHref}>
                  {sunday.bookCta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Link
                href={bookHref}
                className="text-center text-sm font-medium text-white/70 transition-colors hover:text-white sm:text-left"
              >
                {sunday.howItWorks} →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageSection>
  );
}
