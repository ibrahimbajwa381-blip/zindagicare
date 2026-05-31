import { CalendarCheck, Home, Search, Video } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

const stepIcons = [Search, CalendarCheck, Video, Home] as const;
const stepNumbers = ["01", "02", "03", "04"] as const;

export async function HowItWorksSection() {
  const { t } = await getServerTranslations();

  return (
    <PageSection variant="soft" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow={t.howItWorks.eyebrow}
        title={t.howItWorks.title}
        description={t.howItWorks.description}
        align="center"
        className="mx-auto"
      />
      <div className="mt-8 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {t.howItWorks.steps.map((item, index) => {
          const Icon = stepIcons[index];
          return (
            <article key={stepNumbers[index]} className={`relative p-6 ${surfaceCardInteractive}`}>
              <span className="font-display text-4xl font-semibold text-brand/25">
                {stepNumbers[index]}
              </span>
              <span className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-5 w-5" />
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
