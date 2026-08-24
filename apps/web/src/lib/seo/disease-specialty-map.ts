/**
 * Maps common disease/symptom search keywords to the specialty label(s) that
 * treat them, so patients can search "diabetes" or "chest pain" and get
 * relevant doctors even though doctor profiles don't store conditions treated.
 */
const DISEASE_SPECIALTY_MAP: Record<string, string[]> = {
  diabetes: ["Diabetologist", "Endocrinologist"],
  sugar: ["Diabetologist", "Endocrinologist"],
  thyroid: ["Endocrinologist"],
  "heart attack": ["Cardiologist", "Interventional Cardiologist"],
  "chest pain": ["Cardiologist"],
  "high blood pressure": ["Cardiologist", "Hypertension Specialist"],
  hypertension: ["Cardiologist", "Hypertension Specialist"],
  "low blood pressure": ["Cardiologist", "General Physician"],
  cholesterol: ["Cardiologist"],
  "kidney stone": ["Urologist", "Nephrologist"],
  "kidney failure": ["Nephrologist"],
  "kidney transplant": ["Kidney Transplant Surgeon", "Nephrologist"],
  "liver disease": ["Hepatologist", "Gastroenterologist"],
  hepatitis: ["Hepatologist", "Gastroenterologist"],
  jaundice: ["Hepatologist", "Gastroenterologist"],
  asthma: ["Pulmonologist", "Asthma Specialist"],
  cough: ["Pulmonologist", "General Physician"],
  cold: ["General Physician", "ENT Specialist"],
  flu: ["General Physician"],
  fever: ["General Physician"],
  covid: ["General Physician", "Pulmonologist"],
  pneumonia: ["Pulmonologist"],
  tuberculosis: ["Pulmonologist"],
  tb: ["Pulmonologist"],
  migraine: ["Neurologist"],
  headache: ["Neurologist", "General Physician"],
  epilepsy: ["Neurologist"],
  seizure: ["Neurologist"],
  stroke: ["Neurologist", "Neurosurgeon"],
  paralysis: ["Neurologist", "Neurosurgeon"],
  "back pain": ["Orthopedic Surgeon", "Spinal Surgeon", "Physiotherapist"],
  "joint pain": ["Orthopedic Surgeon", "Rheumatologist"],
  arthritis: ["Rheumatologist", "Orthopedic Surgeon"],
  fracture: ["Orthopedic Surgeon"],
  "bone pain": ["Orthopedic Surgeon"],
  "spine problem": ["Spinal Surgeon", "Orthopedic Surgeon"],
  "disc problem": ["Spinal Surgeon", "Neurosurgeon"],
  "skin allergy": ["Dermatologist"],
  allergy: ["Dermatologist", "Immunologist"],
  rash: ["Dermatologist"],
  eczema: ["Dermatologist"],
  psoriasis: ["Dermatologist"],
  acne: ["Dermatologist"],
  pimples: ["Dermatologist"],
  "hair loss": ["Dermatologist", "Hair Transplant Surgeon"],
  baldness: ["Hair Transplant Surgeon", "Dermatologist"],
  "eye problem": ["Eye Specialist", "Eye Surgeon"],
  vision: ["Eye Specialist", "Optometrist"],
  cataract: ["Eye Surgeon", "Eye Specialist"],
  glaucoma: ["Eye Specialist", "Eye Surgeon"],
  "ear pain": ["ENT Specialist"],
  "hearing loss": ["ENT Specialist", "Audiologist"],
  sinus: ["ENT Specialist"],
  tonsillitis: ["ENT Specialist"],
  "throat infection": ["ENT Specialist"],
  "teeth pain": ["Dentist"],
  "tooth pain": ["Dentist"],
  cavity: ["Dentist"],
  "gum disease": ["Periodontist", "Dentist"],
  braces: ["Orthodontist", "Dentist"],
  pregnancy: ["Gynecologist", "Obstetrician"],
  infertility: ["Fertility Consultant", "Gynecologist"],
  "period problems": ["Gynecologist"],
  menstrual: ["Gynecologist"],
  pcos: ["Gynecologist", "Endocrinologist"],
  uti: ["Urologist", "Gynecologist"],
  "urine infection": ["Urologist"],
  prostate: ["Urologist"],
  "erectile dysfunction": ["Sexologist", "Male Sexual Health Specialist", "Urologist"],
  depression: ["Psychiatrist", "Psychologist"],
  anxiety: ["Psychiatrist", "Psychologist"],
  stress: ["Psychiatrist", "Psychologist"],
  insomnia: ["Sleep Medicine Doctor", "Psychiatrist"],
  sleep: ["Sleep Medicine Doctor"],
  autism: ["Autism Consultant", "Pediatric Psychologist"],
  obesity: ["Obesity Specialist", "Bariatric Surgeon", "Dietitian"],
  "weight loss": ["Dietitian", "Nutritionist", "Obesity Specialist"],
  cancer: ["Oncologist"],
  tumor: ["Oncologist"],
  piles: ["General Surgeon", "Colorectal Surgeon"],
  hemorrhoids: ["General Surgeon", "Colorectal Surgeon"],
  fissure: ["General Surgeon", "Colorectal Surgeon"],
  hernia: ["Hernia Surgeon", "General Surgeon"],
  gallstone: ["General Surgeon", "Gastroenterologist"],
  appendicitis: ["General Surgeon"],
  constipation: ["Gastroenterologist"],
  diarrhea: ["Gastroenterologist"],
  typhoid: ["General Physician"],
  "stomach pain": ["Gastroenterologist", "General Physician"],
  ulcer: ["Gastroenterologist"],
  acidity: ["Gastroenterologist"],
  gastric: ["Gastroenterologist"],
  "child fever": ["Pediatrician"],
  vaccination: ["Pediatrician"],
  "speech delay": ["Speech and Language Pathologist"],
  "dental": ["Dentist"],
  "cosmetic surgery": ["Cosmetic Surgeon", "Plastic Surgeon"],
  "plastic surgery": ["Plastic Surgeon"],
  burns: ["Burns Specialist", "Plastic Surgeon"],
  "nerve pain": ["Neurologist"],
  "sports injury": ["Sports Medicine Specialist", "Orthopedic Surgeon"],
  anemia: ["Hematologist"],
  blood: ["Hematologist"],
  pcod: ["Gynecologist", "Endocrinologist"],
  vitiligo: ["Dermatologist"],
  gout: ["Rheumatologist"],
  lupus: ["Rheumatologist"],
  varicose: ["Vascular Surgeon"],
  hearing: ["Audiologist", "ENT Specialist"],
  dizziness: ["Neurologist", "ENT Specialist"],
  "chest infection": ["Pulmonologist"],
  bronchitis: ["Pulmonologist"],
  hiv: ["Immunologist", "General Physician"],
  covid19: ["General Physician", "Pulmonologist"],
};

/** Longest keyword first so multi-word phrases match before shorter substrings. */
const SORTED_KEYWORDS = Object.keys(DISEASE_SPECIALTY_MAP).sort((a, b) => b.length - a.length);

/**
 * Finds specialty labels relevant to a free-text disease/symptom query.
 * Matches on substring overlap in either direction so "sugar patient" or
 * "diabetic" style queries still resolve.
 */
export function findSpecialtiesForKeyword(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 3) return [];

  const matches = new Set<string>();
  for (const keyword of SORTED_KEYWORDS) {
    if (normalized.includes(keyword) || keyword.includes(normalized)) {
      for (const specialty of DISEASE_SPECIALTY_MAP[keyword]) {
        matches.add(specialty);
      }
    }
  }
  return Array.from(matches);
}
