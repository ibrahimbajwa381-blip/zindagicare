import { SPECIALTIES } from "@zindagi/shared";

/** Roman Urdu / Urdu colloquial terms → ZindagiCare specialty labels */
const URDU_SPECIALTY_HINTS: Record<string, string> = {
  dl: "Dermatologist",
  skin: "Dermatologist",
  jild: "Dermatologist",
  جلد: "Dermatologist",
  daane: "Dermatologist",
  دانے: "Dermatologist",
  khasi: "General Physician",
  cough: "General Physician",
  khansi: "General Physician",
  bukhar: "General Physician",
  fever: "General Physician",
  بخار: "General Physician",
  gala: "ENT Specialist",
  throat: "ENT Specialist",
  گلا: "ENT Specialist",
  sar: "General Physician",
  headache: "Neurologist",
  سر: "General Physician",
  cardiologist: "Cardiologist",
  cardiolog: "Cardiologist",
  dil: "Cardiologist",
  heart: "Cardiologist",
  دل: "Cardiologist",
  sugar: "Diabetologist",
  diabetes: "Diabetologist",
  شوگر: "Diabetologist",
  stomach: "Gastroenterologist",
  pet: "Gastroenterologist",
  پیٹ: "Gastroenterologist",
  eye: "Eye Specialist",
  ankh: "Eye Specialist",
  آنکھ: "Eye Specialist",
  bone: "Orthopedic Surgeon",
  haddi: "Orthopedic Surgeon",
  ہڈی: "Orthopedic Surgeon",
  child: "Pediatrician",
  bacha: "Pediatrician",
  بچہ: "Pediatrician",
  bachon: "Pediatrician",
  بچوں: "Pediatrician",
  pregnancy: "Gynecologist",
  hamal: "Gynecologist",
  حمل: "Gynecologist",
  women: "Gynecologist",
  aurat: "Gynecologist",
  عورت: "Gynecologist",
  mental: "Psychiatrist",
  depression: "Psychiatrist",
  tension: "Psychiatrist",
  ذہنی: "Psychiatrist",
  dentist: "Dentist",
  dant: "Dentist",
  دانت: "Dentist",
};

export function resolveSpecialtyFromText(text: string): string | undefined {
  const normalized = text.toLowerCase().trim();

  for (const [hint, specialty] of Object.entries(URDU_SPECIALTY_HINTS)) {
    const pattern = new RegExp(`\\b${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(normalized) || normalized.includes(hint)) {
      return specialty;
    }
  }

  for (const specialty of SPECIALTIES) {
    if (normalized.includes(specialty.toLowerCase())) {
      return specialty;
    }
  }

  return undefined;
}

export function matchDoctorSpecialty(
  doctorSpecialties: string[],
  specialtyHint?: string,
): boolean {
  if (!specialtyHint?.trim()) return true;
  const hint = specialtyHint.toLowerCase();
  return doctorSpecialties.some(
    (s) =>
      s.toLowerCase().includes(hint) ||
      hint.includes(s.toLowerCase()) ||
      s.toLowerCase() === hint,
  );
}
