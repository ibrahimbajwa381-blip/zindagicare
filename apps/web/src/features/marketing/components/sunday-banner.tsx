import Link from "next/link";
import { ArrowRight, Calendar, Gift, Video } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import {
  formatNextSundayLong,
  isSundayBookingOpenNow,
} from "@/lib/sunday/display";
import { sundayConsultCopy } from "@/features/sunday-consult/data/sunday-consult-copy";
import { PageSection } from "@/components/layout/page-section";

export function SundayBanner() {
  const nextSunday = formatNextSundayLong();
  const bookingOpen = isSundayBookingOpenNow();

  return (
    <PageSection id="sunday-free-consult" spacing="tall">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_auto] lg:items-center lg:gap-16 xl:gap-20">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white sm:text-sm">
                <Gift className="h-4 w-4" />
                Rs. 0 · {sundayConsultCopy.durationLabel}
              </p>
              <p className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-muted px-3.5 py-1.5 text-xs font-semibold text-accent-dark sm:text-sm">
                <Calendar className="h-4 w-4 text-accent" />
                {nextSunday}
              </p>
              {bookingOpen && (
                <span className="rounded-full border border-brand/30 bg-brand-muted px-3 py-1 text-xs font-semibold text-brand-dark sm:text-sm">
                  Booking open
                </span>
              )}
            </div>

            <h2 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:mt-8 sm:text-5xl lg:text-6xl xl:text-[3.75rem]">
              <span className="text-brand-dark">Sunday</span> Free Consult
            </h2>
            <p className="mt-3 text-xl font-semibold text-accent-dark sm:mt-4 sm:text-2xl lg:text-[1.75rem]">
              Free video call with a PMDC-verified doctor — every Sunday.
            </p>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-700 sm:mt-6 sm:text-lg lg:text-xl">
              No consultation fee. Book one {sundayConsultCopy.durationLabel} slot per
              doctor, join online at your chosen time, and get medical guidance from home.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-slate-700 sm:mt-10 sm:space-y-4 sm:text-base lg:text-lg">
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                  <Video className="h-5 w-5 text-brand" />
                </span>
                <span className="pt-1">
                  <strong className="font-semibold text-foreground">Online only</strong> —
                  secure video on ZindagiCare, no clinic visit.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                  <Calendar className="h-5 w-5 text-accent" />
                </span>
                <span className="pt-1">
                  <strong className="font-semibold text-foreground">One free slot</strong>{" "}
                  <span className="text-brand-dark">per doctor per week</span> · booking
                  opens 7 days before Sunday.
                </span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row lg:min-w-[18rem] lg:flex-col lg:items-stretch xl:min-w-[20rem]">
            <Button
              size="lg"
              className="group h-14 w-full rounded-xl text-base shadow-premium sm:w-auto lg:min-w-full lg:text-lg"
              asChild
            >
              <Link href={siteConfig.links.sundayConsult}>
                Book free Sunday slot
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 w-full rounded-xl border-accent/40 bg-white text-base text-accent-dark hover:border-accent hover:bg-accent-muted sm:w-auto lg:min-w-full lg:text-lg"
              asChild
            >
              <Link href={`${siteConfig.links.sundayConsult}#how-it-works`}>
                How it works
              </Link>
            </Button>
          </div>
        </div>
    </PageSection>
  );
}
