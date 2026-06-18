"use client";

import { useState } from "react";
import type { HeroService } from "@/features/marketing/data/hero-services";
import { HeroCarousel } from "./hero-carousel";
import { HeroServiceCards } from "./hero-service-cards";
import { PageSection } from "@/components/layout/page-section";

type HeroLabels = {
  learnMore: string;
  swipeHint: string;
  freeBadge: string;
  prevService: string;
  nextService: string;
};

type HeroSectionClientProps = {
  services: HeroService[];
  labels: HeroLabels;
};

export function HeroSectionClient({
  services,
  labels,
}: HeroSectionClientProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <PageSection variant="soft" spacing="sm" innerClassName="space-y-4 sm:space-y-5">
      <HeroCarousel
        services={services}
        activeIndex={activeIndex}
        onIndexChange={setActiveIndex}
        labels={{
          prevService: labels.prevService,
          nextService: labels.nextService,
        }}
      />
      <HeroServiceCards
        services={services}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        labels={labels}
      />
    </PageSection>
  );
}
