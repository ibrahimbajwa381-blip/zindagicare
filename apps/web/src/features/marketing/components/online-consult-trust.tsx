import { Calendar, Lock, ShieldCheck, Wallet } from "lucide-react";
import { cn } from "@zindagi/shared";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

const trustIcons = [ShieldCheck, Wallet, Lock, Calendar] as const;

const trustAccents = [
  { iconBg: "from-brand-dark to-brand", glow: "bg-brand/10" },
  { iconBg: "from-accent to-accent-dark", glow: "bg-accent/10" },
  { iconBg: "from-brand to-brand-light", glow: "bg-brand-light/15" },
  { iconBg: "from-accent-light to-brand-light", glow: "bg-accent-light/15" },
] as const;

export async function OnlineConsultTrust() {
  const { t } = await getServerTranslations();
  const c = t.doctors.page.trust;

  return (
    <PageSection variant="neutral" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow={c.eyebrow}
        title={c.title}
        description={c.description}
        align="center"
        className="mx-auto"
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {c.points.map((point, index) => {
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
              <p className="relative mt-1.5 text-sm leading-relaxed text-slate-600">{point.desc}</p>
            </article>
          );
        })}
      </div>
    </PageSection>
  );
}
