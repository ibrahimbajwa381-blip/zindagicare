"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Clock, Phone, Zap } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { PageSection } from "@/components/layout/page-section";
import { URGENT_CARE_HERO_IMAGE } from "@/features/marketing/data/hero-services";
import { useTranslations } from "@/i18n/locale-provider";
import { URGENT_CONSULT_CONFIG } from "@zindagi/shared";

export function UrgentCareBanner() {
  const t = useTranslations();
  const u = t.urgentCare;
  const pathname = usePathname();
  const onUrgentPage = pathname === siteConfig.links.urgentCare;
  const bookHref = `${siteConfig.links.urgentCare}#request`;

  const scrollToForm = () => {
    document.getElementById("request")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <PageSection
      id="urgent-care"
      spacing="default"
      innerClassName="py-8 sm:py-12 lg:py-16"
    >
      <div className="overflow-hidden rounded-2xl bg-banner-brand shadow-premium-lg sm:rounded-3xl">
        <div className="relative flex flex-col lg:flex-row">
          <div className="relative h-36 w-full shrink-0 sm:h-44 lg:order-2 lg:h-auto lg:min-h-[20rem] lg:w-[40%] xl:min-h-[22rem]">
            <Image
              src={URGENT_CARE_HERO_IMAGE}
              alt="Urgent phone consultation with a PMDC doctor on ZindagiCare"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover object-center lg:object-[center_30%]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-brand-dark/75 via-brand-dark/15 to-transparent lg:bg-gradient-to-l lg:from-brand-dark/60 lg:via-transparent lg:to-transparent"
            />
          </div>

          <div className="flex flex-1 flex-col justify-center px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-lighter/80 sm:text-xs">
              <Zap className="h-3.5 w-3.5" />
              {u.shortName}
            </p>

            <h2 className="mt-2 font-display text-[1.65rem] font-semibold leading-[1.15] tracking-tight text-white sm:mt-3 sm:text-4xl lg:text-[2.75rem]">
              {u.heroHeadline}{" "}
              <span className="text-gradient-hero">{u.heroHeadlineHighlight}</span>
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
              {u.tagline}
            </p>

            <div className="mt-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/90 backdrop-blur-sm sm:text-sm">
              <Phone className="h-4 w-4 shrink-0 text-brand-lighter" />
              <span>
                {u.waitBadge
                  .replace("{min}", String(URGENT_CONSULT_CONFIG.minWaitMinutes))
                  .replace("{max}", String(URGENT_CONSULT_CONFIG.maxWaitMinutes))}
              </span>
              <span className="hidden sm:inline">·</span>
              <Clock className="hidden h-4 w-4 shrink-0 text-brand-lighter sm:inline" />
              <span className="hidden sm:inline">{u.durationLabel}</span>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center">
              {onUrgentPage ? (
                <Button
                  type="button"
                  size="lg"
                  className="group h-11 w-full rounded-xl bg-white px-6 text-sm font-semibold text-brand-dark shadow-premium hover:bg-brand-muted sm:h-12 sm:w-auto sm:text-base"
                  onClick={scrollToForm}
                >
                  {u.requestCta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="group h-11 w-full rounded-xl bg-white px-6 text-sm font-semibold text-brand-dark shadow-premium hover:bg-brand-muted sm:h-12 sm:w-auto sm:text-base"
                  asChild
                >
                  <Link href={bookHref}>
                    {u.requestCta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              )}
              <Link
                href={onUrgentPage ? "#request" : bookHref}
                className="text-center text-sm font-medium text-white/70 transition-colors hover:text-white sm:text-left"
              >
                {u.howItWorks} →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageSection>
  );
}
