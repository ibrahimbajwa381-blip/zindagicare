"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Home, MapPin, ShieldCheck } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { PageSection } from "@/components/layout/page-section";
import { useTranslations } from "@/i18n/locale-provider";
import { HOME_SERVICES_HERO_IMAGE } from "@/features/marketing/data/hero-services";

export function HomeServicesBanner() {
  const t = useTranslations();
  const copy = t.homeServices;
  const hero = copy.hero;
  const bookHref = siteConfig.links.homeCareRequest;

  return (
    <PageSection
      id="home-care"
      spacing="default"
      innerClassName="py-8 sm:py-12 lg:py-16"
    >
      <div className="overflow-hidden rounded-2xl border border-brand-light/35 bg-white shadow-premium-lg sm:rounded-3xl">
        <div className="flex flex-col lg:flex-row">
          <div className="relative h-32 shrink-0 sm:h-36 lg:h-auto lg:w-[36%] xl:w-[34%]">
            <Image
              src={HOME_SERVICES_HERO_IMAGE}
              alt="Pakistani doctor and nurse providing in-house patient care at home"
              fill
              sizes="(max-width: 1024px) 100vw, 34vw"
              className="object-cover object-center"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-accent-dark/50 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-white/90"
            />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm sm:text-xs">
              <Home className="h-3.5 w-3.5" />
              {copy.eyebrow}
            </span>
          </div>

          <div className="flex flex-1 flex-col justify-center border-t border-slate-100 px-5 py-5 sm:px-7 sm:py-7 lg:border-l lg:border-t-0 lg:px-9 lg:py-8">
            <h2 className="font-display text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl lg:text-[2rem]">
              {hero.heroHeadline}{" "}
              <span className="text-brand">{hero.heroHeadlineHighlight}</span>
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:mt-3 sm:text-base">
              {copy.description}
            </p>

            <p className="mt-3 flex max-w-xl items-start gap-2 rounded-xl border border-brand-light/40 bg-brand-muted/50 px-3 py-2.5 text-sm font-medium text-brand-dark">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
              {copy.differentiator}
            </p>

            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
                  <Home className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                {copy.bannerBadge}
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <MapPin className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                {hero.badge}
              </li>
            </ul>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Button
                size="lg"
                className="group h-11 w-full rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-premium hover:bg-brand-dark sm:h-12 sm:w-auto sm:text-base"
                asChild
              >
                <Link href={bookHref}>
                  {hero.primaryCta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 w-full rounded-xl border-accent/30 text-sm text-accent-dark hover:border-accent hover:bg-accent-muted sm:h-12 sm:w-auto sm:text-base"
                asChild
              >
                <Link href={siteConfig.links.homeServices}>
                  {t.common.exploreHomeServices}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageSection>
  );
}
