import { HeartPulse, Lock, MapPin, ShieldCheck } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCard, surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

const trustIcons = [ShieldCheck, Lock, HeartPulse, MapPin] as const;

export async function HomeServicesCoverage() {
  const { t } = await getServerTranslations();
  const c = t.homeServices.coverage;

  return (
    <PageSection variant="neutral" spacing="lg" flipBlur>
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeader
            eyebrow={c.eyebrow}
            title={c.title}
            description={c.description}
          />
          <div className={`mt-8 p-6 ${surfaceCard}`}>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-brand" />
              {c.areasLabel}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {c.areas.map((area) => (
                <li
                  key={area}
                  className="rounded-full border border-brand/15 bg-white/80 px-3 py-1.5 text-sm text-slate-700"
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
            return (
              <article key={point.title} className={`p-5 ${surfaceCardInteractive}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent-dark">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-display text-base font-semibold text-foreground">
                  {point.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
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
