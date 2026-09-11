import { siteConfig } from "@/config/site";
import {
  HOME_PHYSIO_HERO_IMAGE,
  HOME_SERVICES_HERO_IMAGE,
  SUNDAY_FREE_CONSULT_HERO_IMAGE,
  URGENT_CARE_HERO_IMAGE,
  type HeroService,
} from "@/features/marketing/data/hero-services";
import type { Dictionary } from "./dictionaries/en";

const heroIds = [
  "in-house-medical",
  "home-physiotherapy",
  "urgent-care",
  "online-consult",
  "sunday-consult",
] as const;
const heroImages = [
  HOME_SERVICES_HERO_IMAGE,
  HOME_PHYSIO_HERO_IMAGE,
  URGENT_CARE_HERO_IMAGE,
  "/hero/dr-usama-riyaz.webp",
  SUNDAY_FREE_CONSULT_HERO_IMAGE,
] as const;
const heroHrefs = [
  siteConfig.links.homeServices,
  siteConfig.links.homePhysiotherapy,
  `${siteConfig.links.urgentCare}#request`,
  siteConfig.links.doctors,
  `${siteConfig.links.sundayConsult}#request`,
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
