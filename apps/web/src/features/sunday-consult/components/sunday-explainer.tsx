import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Gift,
  Video,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import {
  formatBookingOpensLabel,
  formatNextSundayLong,
  isSundayBookingOpenNow,
} from "@/lib/sunday/display";
import { sundayConsultCopy } from "../data/sunday-consult-copy";
import { surfaceCardInteractive, surfaceInset, surfacePanel } from "@/lib/ui/surfaces";

type SundayExplainerProps = {
  variant?: "compact" | "full";
  showCta?: boolean;
};

export function SundayExplainer({
  variant = "full",
  showCta = true,
}: SundayExplainerProps) {
  const nextSunday = formatNextSundayLong();
  const bookingOpen = isSundayBookingOpenNow();
  const opensLabel = formatBookingOpensLabel();

  if (variant === "compact") {
    return (
      <div className={`p-4 sm:p-5 ${surfaceCardInteractive} border-brand-light/40 bg-brand-muted/70`}>
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <Gift className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold text-foreground">
              {sundayConsultCopy.shortName}
            </p>
            <p className="mt-1 text-sm text-slate-600">{sundayConsultCopy.tagline}</p>
            <p className="mt-2 text-xs font-medium text-brand-dark">
              Next session day: {nextSunday}
            </p>
          </div>
          {showCta && (
            <Button size="sm" className="shrink-0" asChild>
              <Link href={siteConfig.links.sundayConsult}>Book free slot</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className={surfacePanel}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          <Gift className="h-3.5 w-3.5" />
          100% free
        </span>
        <span className="rounded-full bg-accent-muted px-3 py-1 text-xs font-semibold text-accent-muted-foreground">
          {sundayConsultCopy.priceLabel} · {sundayConsultCopy.durationLabel}
        </span>
      </div>

      <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        What is Sunday Free Consult?
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
        Every Sunday, selected doctors on ZindagiCare offer a{" "}
        <strong className="font-medium text-slate-800">
          free {sundayConsultCopy.durationLabel} video consultation
        </strong>{" "}
        — no hidden charges. Talk about symptoms, reports, or follow-ups from home via{" "}
        {sundayConsultCopy.modality.toLowerCase()}.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className={`flex gap-3 p-4 ${surfaceInset} bg-brand-muted/80`}>
          <Calendar className="h-5 w-5 shrink-0 text-brand" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
              When
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{nextSunday}</p>
            <p className="mt-0.5 text-xs text-slate-500">Every Sunday · Pakistan time</p>
          </div>
        </div>
        <div className={`flex gap-3 p-4 ${surfaceInset} bg-accent-muted/80`}>
          <Clock className="h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">
              Booking
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {bookingOpen ? "Open now" : `Opens ${opensLabel}`}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Slots fill quickly</p>
          </div>
        </div>
        <div className={`flex gap-3 p-4 ${surfaceInset}`}>
          <Video className="h-5 w-5 shrink-0 text-slate-700" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              How
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">Online video call</p>
            <p className="mt-0.5 text-xs text-slate-500">No clinic visit required</p>
          </div>
        </div>
      </div>

      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {sundayConsultCopy.steps.map((step, index) => (
          <li
            key={step.title}
            className={`relative p-4 ${surfaceInset}`}
          >
            <span className="font-display text-3xl font-semibold text-brand/15">
              {index + 1}
            </span>
            <p className="mt-1 font-medium text-foreground">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {step.description}
            </p>
          </li>
        ))}
      </ol>

      <ul className="mt-8 space-y-2.5 border-t border-slate-100 pt-6">
        {sundayConsultCopy.rules.map((rule) => (
          <li key={rule} className="flex gap-2.5 text-sm text-slate-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <span>{rule}</span>
          </li>
        ))}
      </ul>

      {showCta && (
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href={siteConfig.links.sundayConsult}>Book your free Sunday slot</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href={siteConfig.links.register}>Create free account</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
