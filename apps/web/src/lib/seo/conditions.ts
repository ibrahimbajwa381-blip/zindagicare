import { conditionBrowse } from "@/features/marketing/data/condition-browse";

/** Maps condition slugs to the specialty label used in doctor profiles and API filters. */
const CONDITION_SPECIALTY_MAP: Record<string, string> = {
  fever: "General Physician",
  "heart-attack": "Cardiologist",
  pregnancy: "Gynecologist",
  "high-blood-pressure": "Cardiologist",
  breathlessness: "Pulmonologist",
  diarrhea: "Gastroenterologist",
  hairfall: "Dermatologist",
  "anxiety-depression": "Psychiatrist",
  "dengue-fever": "General Physician",
  "typhoid-fever": "General Physician",
  piles: "General Surgeon",
  gastritis: "Gastroenterologist",
  hernia: "General Surgeon",
  "vaginal-infection": "Gynecologist",
  migraine: "Neurologist",
  tb: "Pulmonologist",
  acne: "Dermatologist",
};

export type ConditionEntry = {
  slug: string;
  label: string;
  specialty: string;
};

export function getConditionBySlug(slug: string): ConditionEntry | null {
  const normalized = slug.trim().toLowerCase();
  const item = conditionBrowse.find((entry) => entry.slug === normalized);
  const specialty = CONDITION_SPECIALTY_MAP[normalized];
  if (!item || !specialty) return null;
  return { slug: item.slug, label: item.label, specialty };
}

export function getAllConditionSlugs(): string[] {
  return conditionBrowse.map((item) => item.slug);
}

export function conditionDoctorPath(slug: string) {
  return `/doctors/condition/${slug}`;
}

export function conditionSeoTitle(label: string) {
  return `${label} — Online Doctor Consultation in Pakistan | ZindagiCare`;
}

export function conditionSeoDescription(label: string, specialty: string) {
  return `Book an online consultation for ${label.toLowerCase()} with PMDC-verified ${specialty} doctors in Pakistan on ZindagiCare. Compare fees, read reviews, and join a secure video consult from home.`;
}
