/** Nutrition sub-specialties a nutritionist / dietitian can claim on their profile. */
export const NUTRITIONIST_SPECIALTIES = [
  "Clinical Nutrition",
  "Sports Nutrition",
  "Diabetes Management",
  "Weight Management",
  "Pediatric Nutrition",
  "Renal Nutrition",
  "Maternal & Prenatal Nutrition",
  "Gastrointestinal Nutrition",
  "Cardiac & Lipid Nutrition",
  "Oncology Nutrition",
  "Geriatric Nutrition",
  "Food Allergy & Intolerance",
  "Eating Disorder Support",
  "Community & Public Health Nutrition",
] as const;

export type NutritionistSpecialty = (typeof NUTRITIONIST_SPECIALTIES)[number];

/** Max specialties a nutritionist may select (primary + additional combined). */
export const MAX_NUTRITIONIST_SPECIALTIES = 4;

export const NUTRITIONIST_SPECIALTIES_ALPHABETICAL: readonly NutritionistSpecialty[] = [
  ...NUTRITIONIST_SPECIALTIES,
].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

/** Credential body a Pakistani dietitian / nutritionist registers with. */
export const NUTRITIONIST_COUNCIL_LABEL = "PNDS / RD registration number";
