import {
  HERBALIST_SPECIALTIES_ALPHABETICAL,
  NUTRITIONIST_SPECIALTIES_ALPHABETICAL,
} from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { herbalistProfilePath } from "@/lib/herbalists/profile-path";
import { nutritionistProfilePath } from "@/lib/nutritionists/profile-path";
import type { ConsultProviderRole } from "@/server/services/public-consult-provider.service";

export type { ConsultProviderRole };

/** Copy and paths that differ between the herbalist and nutritionist public pages. */
export type ConsultProviderRoleConfig = {
  noun: string;
  nounPlural: string;
  /** Capitalised singular, e.g. "Herbalist". */
  title: string;
  titlePlural: string;
  directoryPath: string;
  profilePath: (slug?: string | null, id?: string) => string;
  /** Eyebrow / field name, e.g. "Herbal medicine". */
  field: string;
  specialties: readonly string[];
  /** Specialties surfaced as quick filters on the directory and landing page. */
  popularSpecialties: readonly string[];
  directoryDescription: string;
  /** Provider sign-up page for this role. */
  registerPath: string;
  aboutFallback: (name: string, city: string) => string;
};

export const CONSULT_PROVIDER_ROLES: Record<ConsultProviderRole, ConsultProviderRoleConfig> = {
  herbalist: {
    noun: "herbalist",
    nounPlural: "herbalists",
    title: "Herbalist",
    titlePlural: "Herbalists",
    directoryPath: siteConfig.links.herbalists,
    profilePath: herbalistProfilePath,
    field: "Herbal medicine",
    specialties: HERBALIST_SPECIALTIES_ALPHABETICAL,
    popularSpecialties: [
      "Unani Medicine (Tibb-e-Unani)",
      "Digestive & Gut Health",
      "Herbal Dermatology",
      "Women's Health & Fertility",
      "Chronic Pain & Inflammation",
      "Respiratory & Immune Support",
    ],
    registerPath: siteConfig.links.registerHerbalist,
    directoryDescription:
      "Verified hakeems and herbal medicine practitioners. Compare qualifications, experience and consultation hours, then consult online from home.",
    aboutFallback: (name, city) =>
      `${name} is a verified herbal medicine practitioner based in ${city}, consulting patients online through ${siteConfig.name}.`,
  },
  nutritionist: {
    noun: "nutritionist",
    nounPlural: "nutritionists",
    title: "Nutritionist",
    titlePlural: "Nutritionists",
    directoryPath: siteConfig.links.nutritionists,
    profilePath: nutritionistProfilePath,
    field: "Nutrition & dietetics",
    specialties: NUTRITIONIST_SPECIALTIES_ALPHABETICAL,
    popularSpecialties: [
      "Weight Management",
      "Diabetes Management",
      "Maternal & Prenatal Nutrition",
      "Pediatric Nutrition",
      "Sports Nutrition",
      "Gastrointestinal Nutrition",
    ],
    registerPath: siteConfig.links.registerNutritionist,
    directoryDescription:
      "Verified nutritionists and dietitians for weight management, diabetes, pregnancy and more. Compare profiles, then consult online from home.",
    aboutFallback: (name, city) =>
      `${name} is a verified nutritionist based in ${city}, consulting patients online through ${siteConfig.name}.`,
  },
};

/** WhatsApp link that pre-fills a consultation request for one provider. */
export function consultRequestWhatsAppHref(role: ConsultProviderRole, name: string): string {
  const text = `Hi ${siteConfig.name}, I'd like to book an online consultation with ${name} (${CONSULT_PROVIDER_ROLES[role].noun}).`;
  return `https://wa.me/${siteConfig.supportWhatsApp}?text=${encodeURIComponent(text)}`;
}

/** WhatsApp link asking the team to match the patient with any provider of this role. */
export function consultMatchWhatsAppHref(role: ConsultProviderRole, specialty?: string): string {
  const noun = CONSULT_PROVIDER_ROLES[role].noun;
  const text = `Hi ${siteConfig.name}, I'd like an online consultation with a ${noun}${specialty ? ` for ${specialty}` : ""}. Please help me find one.`;
  return `https://wa.me/${siteConfig.supportWhatsApp}?text=${encodeURIComponent(text)}`;
}

/** Same filter link the directory's specialty select produces. */
export function consultSpecialtyHref(role: ConsultProviderRole, specialty: string): string {
  return `${CONSULT_PROVIDER_ROLES[role].directoryPath}?specialty=${encodeURIComponent(specialty)}`;
}
