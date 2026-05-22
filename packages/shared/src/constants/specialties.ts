export const SPECIALTIES = [
  "General Physician",
  "Cardiologist",
  "Dermatologist",
  "Gynecologist",
  "Pediatrician",
  "Orthopedic",
  "ENT",
  "Psychiatrist",
  "Dentist",
  "Nutritionist",
] as const;

export type Specialty = (typeof SPECIALTIES)[number];
