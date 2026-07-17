import { Activity, CalendarCheck, ClipboardList, MapPinned } from "lucide-react";
import { cn } from "@zindagi/shared";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

const stepIcons = [ClipboardList, MapPinned, Activity, CalendarCheck] as const;
const stepNumbers = ["01", "02", "03", "04"] as const;

const stepAccents = [
  {
    iconBg: "from-brand-dark to-brand",
    bar: "from-brand-dark to-brand-light",
    glow: "bg-brand/10",
  },
  {
    iconBg: "from-accent to-accent-dark",
    bar: "from-accent to-accent-light",
    glow: "bg-accent/10",
  },
  {
    iconBg: "from-brand to-brand-light",
    bar: "from-brand to-brand-lighter",
    glow: "bg-brand-light/15",
  },
  {
    iconBg: "from-accent-light to-brand-light",
    bar: "from-accent-light to-brand-lighter",
    glow: "bg-accent-light/15",
  },
] as const;

export async function HomePhysioHowItWorks() {
  const { t } = await getServerTranslations();
  const w = t.homePhysio.page.howItWorks;

  return (
    <PageSection id="how-home-physio-works" variant="accent" spacing="lg">
      <SectionHeader
        eyebrow={w.eyebrow}
        title={w.title}
        description={w.description}
        align="center"
        className="mx-auto"
      />

      <div className="mt-8 sm:mt-14">
        <div className="rounded-2xl border border-white/70 bg-white/45 p-3 shadow-premium backdrop-blur-md sm:rounded-3xl sm:p-5 lg:p-6">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {w.steps.map((item, index) => {
              const Icon = stepIcons[index];
              const accent = stepAccents[index];

              return (
                <article
                  key={stepNumbers[index]}
                  className={cn(
                    surfaceCardInteractive,
                    "relative flex gap-4 overflow-hidden p-4 sm:flex-col sm:p-5",
                  )}
                >
                  <div
                    aria-hidden
                    className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accent.bar)}
                  />
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -end-4 -top-4 h-20 w-20 rounded-full blur-2xl",
                      accent.glow,
                    )}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute end-3 top-2 font-display text-4xl font-semibold leading-none text-brand/10 sm:end-4 sm:top-3 sm:text-5xl"
                  >
                    {stepNumbers[index]}
                  </span>

                  <div className="relative shrink-0 sm:mb-1">
                    <span
                      className={cn(
                        "relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ring-1 ring-white/20 sm:h-14 sm:w-14",
                        accent.iconBg,
                      )}
                    >
                      <Icon className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2.25} />
                    </span>
                  </div>

                  <div className="relative min-w-0 flex-1 sm:mt-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-dark">
                      Step {stepNumbers[index]}
                    </p>
                    <h3 className="mt-1 font-display text-base font-semibold leading-snug text-foreground sm:mt-2 sm:text-lg">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:mt-2">
                      {item.desc}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </PageSection>
  );
}
