"use client";

import { useState } from "react";
import { HeroCarousel } from "./hero-carousel";
import { HeroServiceCards } from "./hero-service-cards";
import { PageSection } from "@/components/layout/page-section";

export function HeroSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <PageSection variant="soft" spacing="sm" innerClassName="space-y-4 sm:space-y-5">
      <HeroCarousel activeIndex={activeIndex} onIndexChange={setActiveIndex} />
      <HeroServiceCards activeIndex={activeIndex} onSelect={setActiveIndex} />
    </PageSection>
  );
}
