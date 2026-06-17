import { siteConfig } from "@/config/site";
import {
  HOME_SERVICES_HERO_IMAGE,
  SUNDAY_FREE_CONSULT_HERO_IMAGE,
  type HeroService,
} from "@/features/marketing/data/hero-services";
import type { Dictionary } from "./dictionaries/en";

const heroIds = ["in-house-medical", "online-consult", "sunday-consult"] as const;
const heroImages = [
  HOME_SERVICES_HERO_IMAGE,
  "/hero/dr-usama-riyaz.png",
  SUNDAY_FREE_CONSULT_HERO_IMAGE,
] as const;
const heroHrefs = [
  siteConfig.links.homeServices,
  siteConfig.links.doctors,
  siteConfig.links.sundayConsult,
] as const;

export function getHeroServices(t: Dictionary["hero"]): HeroService[] {
  return t.services.map((service, index) => ({
    id: heroIds[index],
    image: heroImages[index],
    imageAlt: service.imageAlt,
    carousel: {
      ...service.carousel,
      href: heroHrefs[index],
    },
    card: service.card,
  }));
}
