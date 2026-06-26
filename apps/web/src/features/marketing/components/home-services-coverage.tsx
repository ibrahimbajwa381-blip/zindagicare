import { HeartPulse, Lock, MapPin, ShieldCheck } from "lucide-react";
import { cn } from "@zindagi/shared";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCard, surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

const trustIcons = [ShieldCheck, Lock, HeartPulse, MapPin] as const;

const trustAccents = [
  { iconBg: "from-brand-dark to-brand", glow: "bg-brand/10" },
  { iconBg: "from-accent to-accent-dark", glow: "bg-accent/10" },
  { iconBg: "from-brand to-brand-light", glow: "bg-brand-light/15" },
  { iconBg: "from-accent-light to-brand-light", glow: "bg-accent-light/15" },
] as const;

export async function HomeServicesCoverage() {
  const { t } = await getServerTranslations();
  const c = t.homeServices.coverage;

  return (
    <PageSection variant="neutral" spacing="lg" flipBlur>
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
        <div>
          <SectionHeader eyebrow={c.eyebrow} title={c.title} description={c.description} />

          <div className={`relative mt-8 overflow-hidden p-6 sm:p-8 ${surfaceCard}`}>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/10 blur-2xl"
            />
            <p className="relative flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-dark to-brand text-white shadow-sm">
                <MapPin className="h-4 w-4" />
              </span>
              {c.areasLabel}
            </p>
            <ul className="relative mt-5 flex flex-wrap gap-2">
              {c.areas.map((area) => (
                <li
                  key={area}
                  className="rounded-full border border-brand/15 bg-gradient-to-br from-white to-brand-muted/30 px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand/30 hover:shadow-premium"
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {c.trustPoints.map((point, index) => {
            const Icon = trustIcons[index];
            const accent = trustAccents[index];
            return (
              <article
                key={point.title}
                className={cn(surfaceCardInteractive, "relative overflow-hidden p-5 sm:p-6")}
              >
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full blur-2xl",
                    accent.glow,
                  )}
                />
                <span
                  className={cn(
                    "relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ring-1 ring-white/20",
                    accent.iconBg,
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <h3 className="relative mt-4 font-display text-base font-semibold text-foreground">
                  {point.title}
                </h3>
                <p className="relative mt-1.5 text-sm leading-relaxed text-slate-600">
                  {point.desc}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </PageSection>
  );
}
