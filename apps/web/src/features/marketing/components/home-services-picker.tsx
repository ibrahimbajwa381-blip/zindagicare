"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  Bandage,
  Check,
  Clock,
  Droplets,
  Stethoscope,
  Syringe,
  UserRound,
} from "lucide-react";
import { cn, HOME_CARE_PRICING, HomeVisitServiceTypes } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { useTranslations } from "@/i18n/locale-provider";
import { SectionHeader } from "./section-header";

const SERVICE_CONFIG = [
  {
    type: HomeVisitServiceTypes.DOCTOR_VISIT,
    icon: Stethoscope,
    color: "from-brand-dark to-brand",
    bar: "from-brand-dark to-brand-light",
    glow: "bg-brand/10",
    labelKey: "doctorVisit" as const,
    itemKey: "doctorVisit" as const,
    featured: true,
  },
  {
    type: HomeVisitServiceTypes.PHYSIOTHERAPY,
    icon: Activity,
    color: "from-accent to-accent-dark",
    bar: "from-accent to-accent-light",
    glow: "bg-accent/10",
    labelKey: "physiotherapy" as const,
    itemKey: "physiotherapy" as const,
    featured: false,
  },
  {
    type: HomeVisitServiceTypes.NURSE,
    icon: UserRound,
    color: "from-brand to-brand-light",
    bar: "from-brand to-brand-lighter",
    glow: "bg-brand-light/15",
    labelKey: "generalNurse" as const,
    itemKey: "generalNurse" as const,
    featured: false,
  },
  {
    type: HomeVisitServiceTypes.IV_DRIP,
    icon: Droplets,
    color: "from-brand-dark to-brand",
    bar: "from-brand-dark to-brand-light",
    glow: "bg-brand/10",
    labelKey: "ivDrip" as const,
    itemKey: "ivDrip" as const,
    featured: false,
  },
  {
    type: HomeVisitServiceTypes.INJECTION,
    icon: Syringe,
    color: "from-brand to-brand-light",
    bar: "from-brand to-brand-lighter",
    glow: "bg-brand-light/15",
    labelKey: "injection" as const,
    itemKey: "injection" as const,
    featured: false,
  },
  {
    type: HomeVisitServiceTypes.WOUND_CARE,
    icon: Bandage,
    color: "from-accent-light to-brand-light",
    bar: "from-accent-light to-brand-lighter",
    glow: "bg-accent-light/15",
    labelKey: "woundCare" as const,
    itemKey: "woundCare" as const,
    featured: false,
  },
] as const;

const SCENARIO_SERVICE: Record<
  "doctorVisit" | "physiotherapy" | "generalNurse" | "ivDrip" | "injection" | "woundCare",
  (typeof HomeVisitServiceTypes)[keyof typeof HomeVisitServiceTypes]
> = {
  doctorVisit: HomeVisitServiceTypes.DOCTOR_VISIT,
  physiotherapy: HomeVisitServiceTypes.PHYSIOTHERAPY,
  generalNurse: HomeVisitServiceTypes.NURSE,
  ivDrip: HomeVisitServiceTypes.IV_DRIP,
  injection: HomeVisitServiceTypes.INJECTION,
  woundCare: HomeVisitServiceTypes.WOUND_CARE,
};

/** Physiotherapy is booked by choosing a physio from the directory. */
function serviceHref(service: string): string {
  return service === HomeVisitServiceTypes.PHYSIOTHERAPY
    ? siteConfig.links.physiotherapists
    : `${siteConfig.links.homeCareRequest}?service=${service}`;
}

export function HomeServicesPicker() {
  const t = useTranslations();
  const p = t.homeServices.picker;
  const h = t.homeCare;
  const pricing = t.homeServices.pricing;
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const getItemCopy = (itemKey: (typeof SERVICE_CONFIG)[number]["itemKey"]) => {
    if (itemKey === "ivDrip" || itemKey === "injection" || itemKey === "woundCare") {
      return pricing.items[itemKey];
    }
    return p.items[itemKey];
  };

  return (
    <PageSection id="choose-service" variant="soft" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        align="center"
        className="mx-auto"
      />

      <div className="mx-auto mt-8 max-w-3xl">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          {p.scenariosLabel}
        </p>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
          {p.scenarios.map((scenario) => {
            const service =
              SCENARIO_SERVICE[scenario.key as keyof typeof SCENARIO_SERVICE];
            const isActive = highlighted === service;
            return (
              <Link
                key={scenario.key}
                href={serviceHref(service)}
                onMouseEnter={() => setHighlighted(service)}
                onMouseLeave={() => setHighlighted(null)}
                onFocus={() => setHighlighted(service)}
                onBlur={() => setHighlighted(null)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition",
                  isActive
                    ? "border-brand bg-brand text-white shadow-premium"
                    : "border-brand/20 bg-white text-brand-dark hover:border-brand/40 hover:bg-brand-muted/50",
                )}
              >
                {scenario.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {SERVICE_CONFIG.map(({ type, icon: Icon, color, bar, glow, labelKey, itemKey, featured }) => {
          const item = getItemCopy(itemKey);
          const price = HOME_CARE_PRICING[type];
          const isHighlighted = highlighted === type;
          const bookHref = serviceHref(type);

          return (
            <article
              key={type}
              id={`service-${type}`}
              className={cn(
                surfaceCardInteractive,
                "group relative flex flex-col overflow-hidden p-5 sm:p-6",
                featured && "ring-1 ring-brand/15 lg:col-span-1",
                isHighlighted && "border-brand/40 ring-2 ring-brand/20",
              )}
            >
              <div
                aria-hidden
                className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", bar)}
              />
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl transition-opacity",
                  glow,
                  isHighlighted ? "opacity-100" : "opacity-60 group-hover:opacity-100",
                )}
              />

              <div className="relative flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "inline-flex rounded-2xl bg-gradient-to-br p-3 text-white shadow-sm ring-1 ring-white/20",
                    color,
                  )}
                >
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.25} />
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 border-brand/25 bg-brand-muted/30 font-semibold text-brand-dark",
                    featured && "border-brand/40 bg-brand-muted/60",
                  )}
                >
                  {pricing.fromLabel} Rs. {price.toLocaleString()}
                </Badge>
              </div>

              <h3 className="relative mt-4 font-display text-lg font-semibold text-foreground sm:text-xl">
                {h.services[labelKey]}
              </h3>

              <p className="relative mt-2 flex items-center gap-2 text-sm text-slate-500">
                <Clock className="h-4 w-4 shrink-0" />
                {pricing.durationLabel}: {item.duration}
              </p>

              <p className="relative mt-3 flex flex-1 items-start gap-2 text-sm leading-relaxed text-slate-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                {item.includes}
              </p>

              <Button
                className="relative mt-5 w-full rounded-xl shadow-sm group-hover:shadow-premium"
                asChild
              >
                <Link href={bookHref}>
                  {pricing.bookCta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </article>
          );
        })}
      </div>

      <p className="mx-auto mt-8 max-w-xl text-center text-sm text-slate-500">
        {p.notSure}{" "}
        <Link
          href={siteConfig.links.homeCareRequest}
          className="font-medium text-brand-dark underline-offset-2 hover:underline"
        >
          {p.notSureLink}
        </Link>
      </p>
    </PageSection>
  );
}
