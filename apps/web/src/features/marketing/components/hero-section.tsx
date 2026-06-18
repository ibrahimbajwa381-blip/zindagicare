"use client";

import { getHeroServices } from "@/i18n/hero";
import { useTranslations } from "@/i18n/locale-provider";
import { HeroSectionClient } from "./hero-section-client";

export function HeroSection() {
  const t = useTranslations();
  const services = getHeroServices(t.hero);

  return (
    <HeroSectionClient
      services={services}
      labels={{
        learnMore: t.hero.learnMore,
        swipeHint: t.hero.swipeHint,
        freeBadge: t.hero.freeBadge,
        prevService: t.hero.prevService,
        nextService: t.hero.nextService,
      }}
    />
  );
}
