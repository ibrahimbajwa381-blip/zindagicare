import {
  Activity,
  Bone,
  Brain,
  Footprints,
  HeartPulse,
  Zap,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

const conditionIcons = [HeartPulse, Bone, Zap, Brain, Activity, Footprints] as const;

const conditionAccents = [
  { iconBg: "from-brand-dark to-brand", bar: "from-brand-dark to-brand-light" },
  { iconBg: "from-accent to-accent-dark", bar: "from-accent to-accent-light" },
  { iconBg: "from-brand to-brand-light", bar: "from-brand to-brand-lighter" },
  { iconBg: "from-brand-dark to-brand", bar: "from-brand-dark to-brand-light" },
  { iconBg: "from-accent-light to-brand-light", bar: "from-accent-light to-brand-lighter" },
  { iconBg: "from-brand to-brand-light", bar: "from-brand to-brand-lighter" },
] as const;

export async function HomePhysioConditions() {
  const { t } = await getServerTranslations();
  const c = t.homePhysio.page.conditions;

  return (
    <PageSection variant="soft" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow={c.eyebrow}
        title={c.title}
        description={c.description}
        align="center"
        className="mx-auto"
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {c.items.map((item, index) => {
          const Icon = conditionIcons[index];
          const accent = conditionAccents[index];
          return (
            <article
              key={item.title}
              className={cn(surfaceCardInteractive, "relative overflow-hidden p-5 sm:p-6")}
            >
              <div
                aria-hidden
                className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accent.bar)}
              />
              <span
                className={cn(
                  "inline-flex rounded-2xl bg-gradient-to-br p-3 text-white shadow-sm ring-1 ring-white/20",
                  accent.iconBg,
                )}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.25} />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
            </article>
          );
        })}
      </div>
    </PageSection>
  );
}
