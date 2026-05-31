import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Home,
  MapPin,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { surfaceCard, surfaceInset } from "@/lib/ui/surfaces";
import { getServerTranslations } from "@/i18n/server";

const highlightIcons = [ShieldCheck, MapPin, Stethoscope] as const;

export async function HomeServicesHero() {
  const { t } = await getServerTranslations();
  const h = t.homeServices.hero;

  return (
    <PageSection id="home-care" spacing="tall" variant="brand">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white sm:text-sm">
            <Home className="h-4 w-4" />
            {h.badge}
          </p>

          <h1 className="mt-5 font-display text-3xl font-semibold leading-[1.12] tracking-tight text-foreground sm:mt-8 sm:text-5xl lg:text-6xl">
            {h.headline}
          </h1>
          <p className="mt-3 text-lg font-semibold text-brand-dark sm:text-xl lg:text-2xl">
            {h.subheadline}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-700 sm:mt-6 sm:text-lg">
            {h.body}
          </p>

          <ul className="mt-8 space-y-4 sm:mt-10">
            {h.highlights.map((item, index) => {
              const Icon = highlightIcons[index];
              return (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="pt-0.5 text-sm sm:text-base">
                    <strong className="font-semibold text-foreground">
                      {item.title}
                    </strong>
                    <span className="text-slate-600"> — {item.desc}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button size="lg" className="h-12 rounded-xl shadow-premium sm:h-14" asChild>
              <Link href={siteConfig.links.homeCareRequest}>
                {h.primaryCta}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-xl sm:h-14"
              asChild
            >
              <Link href={siteConfig.links.homeCareVisits}>{h.secondaryCta}</Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-12 rounded-xl text-brand-dark sm:h-14"
              asChild
            >
              <Link href="#how-home-care-works">{h.tertiaryCta}</Link>
            </Button>
          </div>
        </div>

        <div className={`p-6 sm:p-8 ${surfaceCard}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-dark">
            {t.homeServices.eyebrow}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {h.stats.map((stat) => (
              <div
                key={stat.label}
                className={`rounded-xl p-4 text-center lg:text-left ${surfaceInset}`}
              >
                <p className="font-display text-2xl font-semibold text-brand-dark sm:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-brand/15 bg-brand-muted/50 px-4 py-3 text-sm text-slate-700">
            <Clock className="h-4 w-4 shrink-0 text-brand" />
            <span>{t.homeServices.pricing.description}</span>
          </div>
        </div>
      </div>
    </PageSection>
  );
}
