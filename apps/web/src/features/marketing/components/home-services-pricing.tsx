import Link from "next/link";
import { ArrowRight, Bandage, Check, Clock, Droplets, Syringe } from "lucide-react";
import {
  HOME_CARE_PRICING,
  HomeVisitServiceTypes,
} from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

const SERVICE_CONFIG = [
  {
    key: "ivDrip" as const,
    type: HomeVisitServiceTypes.IV_DRIP,
    icon: Droplets,
    color: "from-brand-dark to-brand",
  },
  {
    key: "injection" as const,
    type: HomeVisitServiceTypes.INJECTION,
    icon: Syringe,
    color: "from-brand to-brand-light",
  },
  {
    key: "woundCare" as const,
    type: HomeVisitServiceTypes.WOUND_CARE,
    icon: Bandage,
    color: "from-accent to-accent-dark",
  },
] as const;

export async function HomeServicesPricing() {
  const { t } = await getServerTranslations();
  const p = t.homeServices.pricing;

  return (
    <PageSection variant="soft" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        align="center"
        className="mx-auto"
      />
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {SERVICE_CONFIG.map(({ key, type, icon: Icon, color }) => {
          const item = p.items[key];
          const price = HOME_CARE_PRICING[type];
          return (
            <article
              key={key}
              className={`flex flex-col p-6 sm:p-7 ${surfaceCardInteractive}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-flex rounded-xl bg-gradient-to-br ${color} p-3 text-white shadow-sm`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <Badge variant="outline" className="border-brand/30 text-brand-dark">
                  {p.fromLabel} Rs. {price.toLocaleString()}
                </Badge>
              </div>

              <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                {item.title}
              </h3>

              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <Clock className="h-4 w-4 shrink-0" />
                {p.durationLabel}: {item.duration}
              </p>

              <div className="mt-4 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {p.includesLabel}
                </p>
                <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-slate-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  {item.includes}
                </p>
              </div>

              <Button className="mt-6 w-full rounded-xl" asChild>
                <Link href={`${siteConfig.links.homeCareRequest}?service=${type}`}>
                  {p.bookCta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </article>
          );
        })}
      </div>
    </PageSection>
  );
}
