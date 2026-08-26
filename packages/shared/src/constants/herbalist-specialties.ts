/** Herbal-medicine sub-specialties a herbalist can claim on their profile. */
export const HERBALIST_SPECIALTIES = [
  "Ayurvedic Medicine",
  "Unani Medicine (Tibb-e-Unani)",
  "Homeopathy",
  "Traditional Chinese Herbal Medicine",
  "Naturopathy",
  "Western Herbal Medicine",
  "Aromatherapy",
  "Herbal Dermatology",
  "Digestive & Gut Health",
  "Women's Health & Fertility",
  "Respiratory & Immune Support",
  "Chronic Pain & Inflammation",
  "Detoxification & Cleansing",
  "Herbal Pediatrics",
] as const;

export type HerbalistSpecialty = (typeof HERBALIST_SPECIALTIES)[number];

/** Max specialties a herbalist may select (primary + additional combined). */
export const MAX_HERBALIST_SPECIALTIES = 4;

export const HERBALIST_SPECIALTIES_ALPHABETICAL: readonly HerbalistSpecialty[] = [
  ...HERBALIST_SPECIALTIES,
].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

/** Licensing bodies a Pakistani herbalist / hakeem is typically registered with. */
export const HERBALIST_COUNCIL_LABEL = "NCT / Tibb council registration number";
