import { CalendarCheck, ClipboardList, MapPinned, UserCheck } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

const stepIcons = [ClipboardList, UserCheck, MapPinned, CalendarCheck] as const;
const stepNumbers = ["01", "02", "03", "04"] as const;

export async function HomeServicesHowItWorks() {
  const { t } = await getServerTranslations();
  const w = t.homeServices.howItWorks;

  return (
    <PageSection id="how-home-care-works" variant="accent" spacing="lg">
      <SectionHeader
        eyebrow={w.eyebrow}
        title={w.title}
        description={w.description}
        align="center"
        className="mx-auto"
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {w.steps.map((item, index) => {
          const Icon = stepIcons[index];
          return (
            <article
              key={stepNumbers[index]}
              className={`relative p-6 ${surfaceCardInteractive}`}
            >
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
