/** Physiotherapy sub-specialties a physiotherapist can claim on their profile. */
export const PHYSIOTHERAPY_SPECIALTIES = [
  "Orthopedic Physiotherapy",
  "Neurological Physiotherapy",
  "Sports Physiotherapy",
  "Pediatric Physiotherapy",
  "Geriatric Physiotherapy",
  "Cardiopulmonary Physiotherapy",
  "Women's Health Physiotherapy",
  "Post-Surgical Rehabilitation",
  "Spinal Rehabilitation",
  "Musculoskeletal Physiotherapy",
  "Chronic Pain Management",
  "Manual Therapy",
  "Vestibular Rehabilitation",
  "Home Care / Domiciliary Physiotherapy",
] as const;

export type PhysiotherapySpecialty = (typeof PHYSIOTHERAPY_SPECIALTIES)[number];

/** Max specialties a physiotherapist may select. */
export const MAX_PHYSIOTHERAPY_SPECIALTIES = 4;

export const PHYSIOTHERAPY_SPECIALTIES_ALPHABETICAL: readonly PhysiotherapySpecialty[] =
  [...PHYSIOTHERAPY_SPECIALTIES].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
