import { getHeroServices } from "@/i18n/hero";
import { formatMessage, getServerTranslations } from "@/i18n/server";
import { siteConfig } from "@/config/site";
import { HeroSectionClient } from "./hero-section-client";

export async function HeroSection() {
  const { t } = await getServerTranslations();
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
