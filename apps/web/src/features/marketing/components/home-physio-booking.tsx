import Link from "next/link";
import { Activity, ArrowRight, Check, Clock } from "lucide-react";
import { HOME_CARE_PRICING, HomeVisitServiceTypes } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { surfaceCard } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

const bookHref = `${siteConfig.links.homeCareRequest}?service=${HomeVisitServiceTypes.PHYSIOTHERAPY}`;
const price = HOME_CARE_PRICING[HomeVisitServiceTypes.PHYSIOTHERAPY];

export async function HomePhysioBooking() {
  const { t } = await getServerTranslations();
  const b = t.homePhysio.page.booking;

  return (
    <PageSection id="book-physio" variant="brand" spacing="lg" flipBlur>
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-12">
        <SectionHeader eyebrow={b.eyebrow} title={b.title} description={b.description} />

        <div className={`relative overflow-hidden p-6 sm:p-8 ${surfaceCard}`}>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10 blur-2xl"
          />
          <div className="relative flex items-start justify-between gap-3">
            <span className="inline-flex rounded-2xl bg-gradient-to-br from-accent to-accent-dark p-3 text-white shadow-sm ring-1 ring-white/20">
              <Activity className="h-6 w-6" strokeWidth={2.25} />
            </span>
            <Badge variant="outline" className="border-brand/30 bg-brand-muted/40 font-semibold text-brand-dark">
              From Rs. {price.toLocaleString()}
            </Badge>
          </div>

          <h3 className="relative mt-5 font-display text-xl font-semibold text-foreground">
            {t.homeCare.services.physiotherapy}
          </h3>

          <p className="relative mt-2 flex items-center gap-2 text-sm text-slate-500">
            <Clock className="h-4 w-4 shrink-0" />
            {b.durationLabel}: {b.duration}
          </p>

          <p className="relative mt-4 flex items-start gap-2 text-sm leading-relaxed text-slate-600">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
            <span>
              <span className="font-semibold text-foreground">{b.includesLabel}: </span>
              {b.includes}
            </span>
          </p>

          <p className="relative mt-4 rounded-xl border border-brand/10 bg-brand-muted/30 px-4 py-3 text-sm text-slate-700">
            {b.priceNote}
          </p>

          <div className="relative mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <Button size="lg" className="group h-12 rounded-xl shadow-premium" asChild>
              <Link href={bookHref}>
                {b.bookCta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 rounded-xl" asChild>
              <Link href={siteConfig.links.forPhysiotherapists}>{b.providerCta}</Link>
            </Button>
          </div>
        </div>
      </div>
    </PageSection>
  );
}
