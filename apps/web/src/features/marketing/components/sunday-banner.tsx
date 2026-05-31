import Link from "next/link";
import { ArrowRight, Calendar, Gift, Video } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import {
  formatNextSundayLong,
  isSundayBookingOpenNow,
} from "@/lib/sunday/display";
import { PageSection } from "@/components/layout/page-section";
import { formatMessage, getServerTranslations } from "@/i18n/server";

export async function SundayBanner() {
  const { t } = await getServerTranslations();
  const sunday = t.sunday;
  const nextSunday = formatNextSundayLong();
  const bookingOpen = isSundayBookingOpenNow();

  return (
    <PageSection id="sunday-free-consult" spacing="tall">
      <div className="grid gap-8 sm:gap-12 lg:grid-cols-[1.15fr_auto] lg:items-center lg:gap-16 xl:gap-20">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white sm:text-sm">
              <Gift className="h-4 w-4" />
              {sunday.priceLabel} · {sunday.durationLabel}
            </p>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-muted px-3.5 py-1.5 text-xs font-semibold text-accent-dark sm:text-sm">
              <Calendar className="h-4 w-4 text-accent" />
              {nextSunday}
            </p>
            {bookingOpen && (
              <span className="rounded-full border border-brand/30 bg-brand-muted px-3 py-1 text-xs font-semibold text-brand-dark sm:text-sm">
                {t.common.bookingOpen}
              </span>
            )}
          </div>

          <h2 className="mt-5 font-display text-3xl font-semibold leading-[1.12] tracking-tight text-foreground sm:mt-8 sm:text-5xl lg:text-6xl xl:text-[3.75rem]">
            {sunday.bannerTitle}
          </h2>
          <p className="mt-2 text-lg font-semibold text-accent-dark sm:mt-4 sm:text-2xl lg:text-[1.75rem]">
            {sunday.bannerSubtitle}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-700 sm:mt-6 sm:text-lg lg:text-xl">
            {formatMessage(sunday.bannerBody, { duration: sunday.durationLabel })}
          </p>

          <ul className="mt-6 space-y-3 text-sm text-slate-700 sm:mt-10 sm:space-y-4 sm:text-base lg:text-lg">
            <li className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                <Video className="h-5 w-5 text-brand" />
              </span>
              <span className="pt-1">
                <strong className="font-semibold text-foreground">
                  {sunday.onlineOnlyTitle}
                </strong>{" "}
                — {sunday.onlineOnlyDesc}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                <Calendar className="h-5 w-5 text-accent" />
              </span>
              <span className="pt-1">
                <strong className="font-semibold text-foreground">
                  {sunday.oneSlotTitle}
                </strong>{" "}
                <span className="text-brand-dark">{sunday.oneSlotDesc}</span>
              </span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 lg:min-w-[18rem] lg:flex-col lg:items-stretch xl:min-w-[20rem]">
          <Button
            size="lg"
            className="group h-12 w-full rounded-xl text-base shadow-premium sm:h-14 sm:w-auto lg:min-w-full lg:text-lg"
            asChild
          >
            <Link href={siteConfig.links.sundayConsult}>
              {sunday.bookCta}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 w-full rounded-xl border-accent/40 bg-white text-base text-accent-dark hover:border-accent hover:bg-accent-muted sm:h-14 sm:w-auto lg:min-w-full lg:text-lg"
            asChild
          >
            <Link href={`${siteConfig.links.sundayConsult}#how-it-works`}>
              {sunday.howItWorks}
            </Link>
          </Button>
        </div>
      </div>
    </PageSection>
  );
}
