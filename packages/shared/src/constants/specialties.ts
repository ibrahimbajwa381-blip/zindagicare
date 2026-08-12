/** Full specialty list (deduplicated). Featured browse order is the list order; forms sort A–Z. */
export const SPECIALTIES = [
  "Dermatologist",
  "Gynecologist",
  "ENT Specialist",
  "Pediatrician",
  "Orthopedic Surgeon",
  "General Physician",
  "Neurologist",
  "Urologist",
  "Eye Specialist",
  "Psychiatrist",
  "Dentist",
  "Gastroenterologist",
  "Cardiologist",
  "Pulmonologist",
  "Diabetologist",
  "General Surgeon",
  "Endocrinologist",
  "Nephrologist",
  "Pain Management Specialist",
  "Counselor",
  "Psychologist",
  "Consultant Physician",
  "Neonatologist",
  "Obstetrician",
  "Cosmetologist",
  "Aesthetic Physician",
  "Dietitian",
  "Nutritionist",
  "Laser Specialist",
  "Anesthesiologist",
  "Pediatric Psychologist",
  "Hepatologist",
  "Sexologist",
  "Male Sexual Health Specialist",
  "Internal Medicine Specialist",
  "Family Physician",
  "Obesity Specialist",
  "Oncologist",
  "Radiation Oncologist",
  "Uro-Oncologist",
  "Pediatric Oncologist",
  "Andrologist",
  "Pediatric Surgeon",
  "Laparoscopic Surgeon",
  "Hypertension Specialist",
  "Speech and Language Pathologist",
  "Fertility Consultant",
  "Kidney Transplant Surgeon",
  "Renal Surgeon",
  "Hernia Surgeon",
  "Pediatric Urologist",
  "Endoscopic Surgeon",
  "Aesthetic Gynecologist",
  "Interventional Cardiologist",
  "Endodontist",
  "Colorectal Surgeon",
  "Breast Surgeon",
  "Cancer Surgeon",
  "Thyroid Surgeon",
  "Orthodontist",
  "Implantologist",
  "Prosthodontist",
  "Cosmetic Dentist",
  "Eye Surgeon",
  "ENT Surgeon",
  "Head and Neck Surgeon",
  "Physiotherapist",
  "Acupuncturist",
  "Neurosurgeon",
  "Oral and Maxillofacial Surgeon",
  "Plastic Surgeon",
  "Hair Transplant Surgeon",
  "Burns Specialist",
  "Cosmetic Surgeon",
  "Neuromusculoskeletal Medicine Doctor",
  "Bariatric Surgeon",
  "Restorative Dentist",
  "Pediatric Nutritionist",
  "Rehab Medicine",
  "Rehabilitation Specialist",
  "Diabetes Counsellor",
  "Spinal Surgeon",
  "Pediatric Hematologist",
  "Audiologist",
  "Pathologist",
  "Histopathologist",
  "Pediatric Neurologist",
  "Homeopath",
  "Pediatric Rheumatologist",
  "Cardiothoracic Surgeon",
  "Nuclear Medicine Specialist",
  "Vitreo Retina Surgeon",
  "Hematologist",
  "Geriatrician",
  "Chiropractor",
  "Sonologist",
  "Nutritional Psychologist",
  "Pediatric Gastroenterologist",
  "Sports Medicine Specialist",
  "Radiologist",
  "Hand Surgeon",
  "Immunologist",
  "Asthma Specialist",
  "Thoracic Surgeon",
  "Specialist in Operative Dentistry",
  "Pediatric Neurosurgeon",
  "Vascular Surgeon",
  "Pediatric Orthopedic Surgeon",
  "Child-Kidney Specialist",
  "Pediatric Endocrinologist",
  "Pediatric Diabetologist",
  "Autism Consultant",
  "Alternative Medicine Practitioner",
  "Periodontist",
  "Reconstructive Surgeon",
  "Rheumatologist",
  "Lifestyle Medicine Physician",
  "Hepatobiliary and Liver Transplant Surgeon",
  "Orthotist and Prosthetist",
  "Cardiac Surgeon",
  "Cardiovascular Surgeon",
  "Emergency Medicine Specialist",
  "Community Medicine",
  "Maternal Fetal Medicine Specialist",
  "Occupational Therapist",
  "Sleep Medicine Doctor",
  "Podiatrist",
  "Optometrist",
  "Critical Care Physician",
  "Pediatric Cardiologist",
  "Primary Care Physician",
  "Fitness Trainer",
  "Naturopathic Doctor",
  "Endovascular Surgeon",
  "Colorectal Cancer Surgeon",
] as const;

export type Specialty = (typeof SPECIALTIES)[number];

/** Max additional specialties a doctor may request beyond the primary. */
export const MAX_ADDITIONAL_SPECIALTIES = 4;

/** Max admin-verified specialties visible to patients (primary + additional). */
export const MAX_VERIFIED_SPECIALTIES = MAX_ADDITIONAL_SPECIALTIES + 1;

const SPECIALTY_SET = new Set<string>(SPECIALTIES);

/** Alphabetically sorted copy for searchable specialty pickers. */
export const SPECIALTIES_ALPHABETICAL: readonly Specialty[] = [...SPECIALTIES].sort((a, b) =>
  a.localeCompare(b, "en", { sensitivity: "base" }),
);

export function isKnownSpecialty(value: string): value is Specialty {
  return SPECIALTY_SET.has(value);
}

/** Deduplicate additional specialties and drop the primary if repeated. */
export function normalizeAdditionalSpecialties(
  primarySpecialty: string,
  additionalSpecialties: readonly string[],
): string[] {
  const primary = primarySpecialty.trim();
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of additionalSpecialties) {
    const value = raw.trim();
    if (!value || value === primary || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

/** Claimed specialties in display order: primary first, then additional. */
export function claimedSpecialties(
  primarySpecialty: string | undefined | null,
  additionalSpecialties: readonly string[] | undefined | null,
): string[] {
  const primary = primarySpecialty?.trim();
  const additional = normalizeAdditionalSpecialties(
    primary ?? "",
    additionalSpecialties ?? [],
  );
  return primary ? [primary, ...additional] : additional;
}

/**
 * Specialty shown on cards / titles: prefer verified primary, else first verified,
 * else claimed primary (doctor-facing fallback).
 */
export function resolveDisplaySpecialty(input: {
  primarySpecialty?: string | null;
  specialties?: readonly string[] | null;
  fallback?: string;
}): string {
  const verified = input.specialties ?? [];
  const primary = input.primarySpecialty?.trim();
  if (primary && verified.includes(primary)) return primary;
  if (verified[0]) return verified[0];
  if (primary) return primary;
  return input.fallback ?? "General Physician";
}
