/** Nursing specialties a nurse can claim on their profile. */
export const NURSING_SPECIALTIES = [
  "General Home Nursing",
  "Elderly / Geriatric Care",
  "Post-Operative Care",
  "Wound Care",
  "IV Therapy & Cannulation",
  "Critical / ICU Care",
  "Pediatric Nursing",
  "Maternal & Newborn Care",
  "Palliative Care",
  "Diabetes Care",
  "Cardiac Care",
  "Stroke & Neuro Care",
  "Dialysis Care",
  "Oncology Nursing",
  "Mental Health Nursing",
] as const;

export type NursingSpecialty = (typeof NURSING_SPECIALTIES)[number];

/** Max specialties a nurse may select. */
export const MAX_NURSING_SPECIALTIES = 4;

export const NURSING_SPECIALTIES_ALPHABETICAL: readonly NursingSpecialty[] =
  [...NURSING_SPECIALTIES].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
