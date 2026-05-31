import { siteConfig } from "@/config/site";
import type { HeroService } from "@/features/marketing/data/hero-services";
import type { Dictionary } from "./dictionaries/en";

const heroIds = ["online-consult", "sunday-consult", "in-house-medical"] as const;
const heroImages = [
  "/hero/online-consult.jpg",
  "/hero/in-clinic.jpg",
  "/hero/home-care.jpg",
] as const;
const heroHrefs = [
  siteConfig.links.doctors,
  siteConfig.links.sundayConsult,
  siteConfig.links.homeServices,
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
