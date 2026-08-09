"use client";

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
import { surfaceCardInteractive, surfaceInset, surfacePanel } from "@/lib/ui/surfaces";
import { formatMessage } from "@/i18n/messages";
import { useTranslations } from "@/i18n/locale-provider";

type SundayExplainerProps = {
  variant?: "compact" | "full";
  showCta?: boolean;
  /** Hide title + lead paragraph when the parent page provides its own intro. */
  hideIntro?: boolean;
};

export function SundayExplainer({
  variant = "full",
  showCta = true,
  hideIntro = false,
}: SundayExplainerProps) {
  const t = useTranslations();
  const copy = t.sunday;
  const ex = copy.explainer;
  const nextSunday = formatNextSundayLong();
  const bookingOpen = isSundayBookingOpenNow();
  const opensLabel = formatBookingOpensLabel();

  if (variant === "compact") {
    return (
      <div
        className={`p-4 sm:p-5 ${surfaceCardInteractive} border-brand-light/40 bg-brand-muted/70`}
      >
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <Gift className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold text-foreground">
              {copy.shortName}
            </p>
            <p className="mt-1 text-sm text-slate-600">{copy.tagline}</p>
            <p className="mt-2 text-xs font-medium text-brand-dark">
              {formatMessage(ex.nextSession, { date: nextSunday })}
            </p>
          </div>
          {showCta && (
            <Button size="sm" className="shrink-0" asChild>
              <Link href={`${siteConfig.links.sundayConsult}#request`}>{ex.bookFreeSlot}</Link>
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
          {ex.hundredPercentFree}
        </span>
        <span className="rounded-full bg-accent-muted px-3 py-1 text-xs font-semibold text-accent-muted-foreground">
          {copy.priceLabel} · {copy.durationLabel}
        </span>
      </div>

      {!hideIntro && (
        <>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {ex.whatIsTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            {formatMessage(ex.whatIsBody, {
              duration: copy.durationLabel,
              modality: copy.modality,
            })}
          </p>
        </>
      )}

      <div className={`grid gap-4 sm:grid-cols-3 ${hideIntro ? "mt-4" : "mt-6"}`}>
        <div className={`flex gap-3 p-4 ${surfaceInset} bg-brand-muted/80`}>
          <Calendar className="h-5 w-5 shrink-0 text-brand" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
              {ex.when}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{nextSunday}</p>
            <p className="mt-0.5 text-xs text-slate-500">{ex.everySunday}</p>
          </div>
        </div>
        <div className={`flex gap-3 p-4 ${surfaceInset} bg-accent-muted/80`}>
          <Clock className="h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">
              {ex.booking}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {bookingOpen ? ex.openNow : formatMessage(ex.opens, { label: opensLabel })}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{ex.slotsFill}</p>
          </div>
        </div>
        <div className={`flex gap-3 p-4 ${surfaceInset}`}>
          <Video className="h-5 w-5 shrink-0 text-slate-700" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {ex.how}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{ex.onlineVideo}</p>
            <p className="mt-0.5 text-xs text-slate-500">{ex.noClinic}</p>
          </div>
        </div>
      </div>

      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {copy.steps.map((step, index) => (
          <li key={step.title} className={`relative p-4 ${surfaceInset}`}>
            <span className="font-display text-3xl font-semibold text-brand/15">
              {index + 1}
            </span>
            <p className="mt-1 font-medium text-foreground">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{step.description}</p>
          </li>
        ))}
      </ol>

      <ul className="mt-8 space-y-2.5 border-t border-slate-100 pt-6">
        {copy.rules.map((rule) => (
          <li key={rule} className="flex gap-2.5 text-sm text-slate-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <span>{rule}</span>
          </li>
        ))}
      </ul>

      {showCta && (
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href={`${siteConfig.links.sundayConsult}#request`}>{ex.bookYourSlot}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href={siteConfig.links.register}>{ex.createAccount}</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
