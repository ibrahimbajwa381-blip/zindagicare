"use client";

import Link from "next/link";
import { ArrowRight, Bandage, Home, HeartPulse, Syringe } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/locale-provider";
import { HomeServicesBanner } from "./home-services-banner";

const serviceIcons = [Home, Syringe, Bandage, HeartPulse] as const;
const serviceColors = [
  "from-brand-dark to-brand",
  "from-brand to-brand-light",
  "from-brand-light to-accent-light",
  "from-accent to-accent-dark",
] as const;

type Props = {
  /** `catalog` = full page section; `preview` = homepage teaser (default) */
  variant?: "catalog" | "preview";
};

export function HomeServicesPreview({ variant = "preview" }: Props) {
  const t = useTranslations();

  if (variant === "preview") {
    return <HomeServicesBanner />;
  }
  const header = t.homeServices.catalog;

  return (
    <PageSection variant="accent" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow={header.eyebrow}
        title={header.title}
        description={header.description}
        align="center"
        className="mx-auto"
      />
      <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {t.homeServices.items.map((service, index) => {
          const Icon = serviceIcons[index];
          const color = serviceColors[index];
          return (
            <article key={service.title} className={`group p-6 ${surfaceCardInteractive}`}>
              <span
                className={`inline-flex rounded-xl bg-gradient-to-br ${color} p-2.5 text-white shadow-sm`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-foreground">
                {service.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{service.desc}</p>
            </article>
          );
        })}
      </div>
      <Button
        className="mx-auto mt-8 flex h-12 w-full rounded-xl px-6 text-base shadow-premium sm:mt-10 sm:w-auto"
        asChild
      >
        <Link href="/home-care/request">
          {t.homeCare.bookVisit}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </PageSection>
  );
}

