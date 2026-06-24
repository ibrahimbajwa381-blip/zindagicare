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
    labelKey: "doctorVisit" as const,
    itemKey: "doctorVisit" as const,
  },
  {
    type: HomeVisitServiceTypes.PHYSIOTHERAPY,
    icon: Activity,
    color: "from-accent to-accent-dark",
    labelKey: "physiotherapy" as const,
    itemKey: "physiotherapy" as const,
  },
  {
    type: HomeVisitServiceTypes.NURSE,
    icon: UserRound,
    color: "from-brand to-brand-light",
    labelKey: "generalNurse" as const,
    itemKey: "generalNurse" as const,
  },
  {
    type: HomeVisitServiceTypes.IV_DRIP,
    icon: Droplets,
    color: "from-brand-dark to-brand",
    labelKey: "ivDrip" as const,
    itemKey: "ivDrip" as const,
  },
  {
    type: HomeVisitServiceTypes.INJECTION,
    icon: Syringe,
    color: "from-brand to-brand-light",
    labelKey: "injection" as const,
    itemKey: "injection" as const,
  },
  {
    type: HomeVisitServiceTypes.WOUND_CARE,
    icon: Bandage,
    color: "from-brand-light to-accent-light",
    labelKey: "woundCare" as const,
    itemKey: "woundCare" as const,
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
            return (
            <Link
              key={scenario.key}
              href={`${siteConfig.links.homeCareRequest}?service=${service}`}
              onMouseEnter={() => setHighlighted(service)}
              onMouseLeave={() => setHighlighted(null)}
              onFocus={() => setHighlighted(service)}
              onBlur={() => setHighlighted(null)}
              className="shrink-0 rounded-full border border-brand/25 bg-white px-4 py-2 text-sm font-medium text-brand-dark shadow-sm transition hover:border-brand hover:bg-brand-muted/40"
            >
              {scenario.label}
            </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {SERVICE_CONFIG.map(({ type, icon: Icon, color, labelKey, itemKey }) => {
          const item = getItemCopy(itemKey);
          const price = HOME_CARE_PRICING[type];
          const isHighlighted = highlighted === type;
          const bookHref = `${siteConfig.links.homeCareRequest}?service=${type}`;

          return (
            <article
              key={type}
              id={`service-${type}`}
              className={cn(
                `group flex flex-col p-5 sm:p-6 ${surfaceCardInteractive}`,
                isHighlighted && "border-brand/40 ring-2 ring-brand/20",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-flex rounded-xl bg-gradient-to-br ${color} p-2.5 text-white shadow-sm`}
                >
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <Badge variant="outline" className="border-brand/30 text-brand-dark">
                  {pricing.fromLabel} Rs. {price.toLocaleString()}
                </Badge>
              </div>

              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {h.services[labelKey]}
              </h3>

              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <Clock className="h-4 w-4 shrink-0" />
                {pricing.durationLabel}: {item.duration}
              </p>

              <p className="mt-3 flex flex-1 items-start gap-2 text-sm leading-relaxed text-slate-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                {item.includes}
              </p>

              <Button className="mt-5 w-full rounded-xl" asChild>
                <Link href={bookHref}>
                  {pricing.bookCta}
                  <ArrowRight className="h-4 w-4" />
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
