"use client";

import { getHeroServices } from "@/i18n/hero";
import { formatMessage } from "@/i18n/messages";
import { useTranslations } from "@/i18n/locale-provider";
import { siteConfig } from "@/config/site";
import { HeroSectionClient } from "./hero-section-client";

export function HeroSection() {
  const t = useTranslations();
  const services = getHeroServices(t.hero);
  const servingPatients = formatMessage(t.hero.servingPatients, {
    city: siteConfig.launchCity,
  });

  return (
    <HeroSectionClient
      services={services}
      labels={{
        learnMore: t.hero.learnMore,
        swipeHint: t.hero.swipeHint,
        servingPatients,
        freeBadge: t.hero.freeBadge,
        prevService: t.hero.prevService,
        nextService: t.hero.nextService,
      }}
    />
  );
}
