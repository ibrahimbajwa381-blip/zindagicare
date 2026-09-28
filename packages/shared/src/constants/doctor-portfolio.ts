/**
 * Limits and quick-pick suggestions for the doctor public portfolio
 * (/doctor/portfolio editor → /doctors/[slug] public page).
 */
export const DOCTOR_PORTFOLIO_LIMITS = {
  headline: 120,
  bio: 2000,
  approach: 1000,
  tag: 60,
  languages: 8,
  conditionsTreated: 25,
  memberships: 10,
  services: 15,
  serviceName: 100,
  serviceDescription: 300,
  /** Upper bound for an optional per-service fee, in PKR. */
  serviceFee: 1_000_000,
  education: 10,
  experience: 12,
  certifications: 15,
  awards: 10,
  publications: 20,
  faqs: 10,
  faqQuestion: 200,
  faqAnswer: 800,
  experienceDescription: 500,
  url: 300,
} as const;

/**
 * Public page sections a doctor can hide. "about" is intentionally absent — the hero and
 * bio always render so a profile is never blank.
 */
export const DOCTOR_PORTFOLIO_HIDEABLE_SECTIONS = [
  "video",
  "services",
  "conditions",
  "experience",
  "education",
  "certifications",
  "awards",
  "publications",
  "memberships",
  "faqs",
  "links",
] as const;
export type DoctorPortfolioHideableSection = (typeof DOCTOR_PORTFOLIO_HIDEABLE_SECTIONS)[number];

/**
 * Social / professional links. `hosts` restricts each link to its own platform (subdomains
 * allowed) so a "LinkedIn" button can never point somewhere unexpected; `website` accepts
 * any https host.
 */
export const DOCTOR_PORTFOLIO_LINKS = {
  website: { label: "Website", hosts: null },
  linkedin: { label: "LinkedIn", hosts: ["linkedin.com"] },
  facebook: { label: "Facebook", hosts: ["facebook.com", "fb.com"] },
  instagram: { label: "Instagram", hosts: ["instagram.com"] },
  youtube: { label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  x: { label: "X (Twitter)", hosts: ["x.com", "twitter.com"] },
  researchgate: { label: "ResearchGate", hosts: ["researchgate.net"] },
  googleScholar: { label: "Google Scholar", hosts: ["scholar.google.com"] },
} as const;
export type DoctorPortfolioLinkKey = keyof typeof DOCTOR_PORTFOLIO_LINKS;
export const DOCTOR_PORTFOLIO_LINK_KEYS = Object.keys(DOCTOR_PORTFOLIO_LINKS) as DoctorPortfolioLinkKey[];

export const DOCTOR_TRAINING_SUGGESTIONS = [
  "House job",
  "FCPS residency",
  "MCPS",
  "MS / MD residency",
  "Fellowship",
  "MRCP",
  "FRCS",
] as const;

export const DOCTOR_MEMBERSHIP_SUGGESTIONS = [
  "Pakistan Medical Association (PMA)",
  "College of Physicians & Surgeons Pakistan (CPSP)",
  "Pakistan Society of Internal Medicine",
  "Pakistan Pediatric Association",
  "Society of Obstetricians & Gynaecologists of Pakistan",
  "Pakistan Cardiac Society",
  "Pakistan Association of Dermatologists",
  "Pakistan Psychiatric Society",
  "Royal College of Physicians (UK)",
] as const;

type SpecialtySuggestions = { conditions: readonly string[]; services: readonly string[] };

const GENERAL_SUGGESTIONS: SpecialtySuggestions = {
  conditions: [
    "Fever",
    "Diabetes",
    "Hypertension",
    "Cough & flu",
    "Stomach infection",
    "Headache",
    "Allergies",
    "Thyroid disorders",
    "Fatigue & weakness",
    "Vitamin deficiency",
  ],
  services: [
    "Online video consultation",
    "Clinic consultation",
    "Follow-up consultation",
    "Health check-up",
    "Lab report review",
    "Second opinion",
  ],
};

/**
 * Keyed by entries in SPECIALTIES. Unlisted specialties fall back to general suggestions;
 * doctors can always type their own.
 */
const SPECIALTY_SUGGESTIONS: Record<string, SpecialtySuggestions> = {
  Dermatologist: {
    conditions: ["Acne", "Eczema", "Psoriasis", "Hair loss", "Pigmentation / melasma", "Fungal infections", "Vitiligo", "Skin allergies", "Warts", "Scabies"],
    services: ["Skin consultation", "Chemical peel", "Acne scar treatment", "PRP for hair loss", "Laser hair removal", "Mole / wart removal"],
  },
  Gynecologist: {
    conditions: ["PCOS", "Irregular periods", "Pregnancy care", "Infertility", "Menopause", "Fibroids", "Vaginal infections", "Endometriosis"],
    services: ["Antenatal check-up", "Pregnancy ultrasound", "Infertility consultation", "Pap smear", "Family planning advice", "Postnatal care"],
  },
  Obstetrician: {
    conditions: ["Pregnancy care", "High-risk pregnancy", "Gestational diabetes", "Pre-eclampsia", "Recurrent miscarriage"],
    services: ["Antenatal check-up", "Pregnancy ultrasound", "Normal delivery", "C-section", "Postnatal care"],
  },
  Pediatrician: {
    conditions: ["Fever in children", "Diarrhea", "Chest infections", "Growth & development concerns", "Childhood asthma", "Allergies", "Malnutrition", "Newborn jaundice"],
    services: ["Well-baby check-up", "Vaccination advice", "Growth monitoring", "Newborn care", "Nutrition counseling"],
  },
  Neonatologist: {
    conditions: ["Newborn jaundice", "Prematurity", "Low birth weight", "Neonatal infections", "Feeding problems"],
    services: ["Newborn check-up", "Preterm baby follow-up", "Breastfeeding support"],
  },
  Cardiologist: {
    conditions: ["Hypertension", "Chest pain", "Heart failure", "Coronary artery disease", "Arrhythmia", "High cholesterol", "Palpitations"],
    services: ["ECG", "Echocardiography", "Exercise tolerance test (ETT)", "Holter monitoring", "Cardiac risk assessment", "Angiography consultation"],
  },
  Neurologist: {
    conditions: ["Migraine", "Epilepsy", "Stroke", "Parkinson's disease", "Neuropathy", "Vertigo", "Multiple sclerosis", "Memory loss"],
    services: ["Neurology consultation", "EEG", "Nerve conduction study (NCS)", "EMG", "Headache clinic"],
  },
  Psychiatrist: {
    conditions: ["Depression", "Anxiety", "OCD", "Bipolar disorder", "Insomnia", "Schizophrenia", "ADHD", "Addiction"],
    services: ["Psychiatric assessment", "Medication management", "Online therapy session", "De-addiction program"],
  },
  Psychologist: {
    conditions: ["Anxiety", "Depression", "Stress", "Relationship issues", "Grief", "Low self-esteem", "Panic attacks"],
    services: ["Individual therapy", "Couples counseling", "CBT", "Psychological assessment"],
  },
  "Orthopedic Surgeon": {
    conditions: ["Knee pain", "Back pain", "Fractures", "Arthritis", "Sports injuries", "Frozen shoulder", "Slipped disc", "Osteoporosis"],
    services: ["Orthopedic consultation", "Joint injection", "Knee replacement", "Hip replacement", "Arthroscopy", "Fracture fixation"],
  },
  "ENT Specialist": {
    conditions: ["Sinusitis", "Tonsillitis", "Ear infection", "Hearing loss", "Nasal allergy", "Vertigo", "Snoring", "Deviated septum"],
    services: ["ENT consultation", "Audiometry", "Tonsillectomy", "Sinus surgery", "Ear wax removal"],
  },
  "Eye Specialist": {
    conditions: ["Cataract", "Glaucoma", "Diabetic retinopathy", "Dry eyes", "Refractive errors", "Squint", "Eye infections"],
    services: ["Eye examination", "Cataract surgery", "LASIK consultation", "Glaucoma screening", "Retina check-up"],
  },
  Urologist: {
    conditions: ["Kidney stones", "Prostate enlargement", "Urinary tract infection", "Urinary incontinence", "Blood in urine"],
    services: ["Urology consultation", "Stone removal (URS / PCNL)", "Prostate surgery (TURP)", "Cystoscopy"],
  },
  Gastroenterologist: {
    conditions: ["Acid reflux / GERD", "IBS", "Hepatitis", "Fatty liver", "Ulcers", "Constipation", "Inflammatory bowel disease"],
    services: ["GI consultation", "Endoscopy", "Colonoscopy", "Liver function assessment"],
  },
  Hepatologist: {
    conditions: ["Hepatitis B", "Hepatitis C", "Fatty liver", "Cirrhosis", "Jaundice"],
    services: ["Liver consultation", "Fibroscan", "Hepatitis treatment plan"],
  },
  Pulmonologist: {
    conditions: ["Asthma", "COPD", "Tuberculosis", "Pneumonia", "Chronic cough", "Sleep apnea", "Allergic rhinitis"],
    services: ["Chest consultation", "Spirometry / PFT", "Bronchoscopy", "Sleep study"],
  },
  Diabetologist: {
    conditions: ["Type 1 diabetes", "Type 2 diabetes", "Gestational diabetes", "Diabetic foot", "Prediabetes"],
    services: ["Diabetes consultation", "Insulin initiation", "HbA1c review", "Diabetic foot care", "Diet planning"],
  },
  Endocrinologist: {
    conditions: ["Diabetes", "Thyroid disorders", "PCOS", "Obesity", "Osteoporosis", "Growth disorders", "Adrenal disorders"],
    services: ["Endocrine consultation", "Thyroid ultrasound review", "Hormone assessment"],
  },
  Nephrologist: {
    conditions: ["Chronic kidney disease", "Kidney failure", "Nephrotic syndrome", "Hypertension", "Electrolyte imbalance"],
    services: ["Kidney consultation", "Dialysis planning", "Kidney transplant follow-up"],
  },
  Oncologist: {
    conditions: ["Breast cancer", "Lung cancer", "Blood cancers", "Colorectal cancer", "Head & neck cancer"],
    services: ["Oncology consultation", "Chemotherapy planning", "Second opinion", "Cancer screening"],
  },
  "General Surgeon": {
    conditions: ["Hernia", "Gallstones", "Appendicitis", "Piles", "Anal fissure", "Lumps & cysts", "Thyroid swelling"],
    services: ["Surgical consultation", "Laparoscopic cholecystectomy", "Hernia repair", "Piles surgery", "Minor procedures"],
  },
  Dentist: {
    conditions: ["Toothache", "Tooth decay", "Gum disease", "Crooked teeth", "Tooth sensitivity", "Missing teeth"],
    services: ["Dental check-up", "Scaling & polishing", "Root canal treatment", "Braces", "Dental implants", "Teeth whitening"],
  },
  "Pain Management Specialist": {
    conditions: ["Chronic back pain", "Neck pain", "Sciatica", "Neuropathic pain", "Cancer pain", "Joint pain"],
    services: ["Pain consultation", "Nerve block", "Epidural steroid injection", "Radiofrequency ablation"],
  },
  Cosmetologist: {
    conditions: ["Pigmentation", "Acne scars", "Fine lines & wrinkles", "Hair loss", "Dull skin"],
    services: ["HydraFacial", "Botox", "Fillers", "Chemical peel", "PRP", "Laser treatments"],
  },
  "Aesthetic Physician": {
    conditions: ["Fine lines & wrinkles", "Pigmentation", "Acne scars", "Volume loss", "Hair loss"],
    services: ["Botox", "Dermal fillers", "Thread lift", "PRP", "Skin boosters"],
  },
};

/** Specialty-aware chips for the editor; merges suggestions across all of a doctor's specialties. */
export function doctorPortfolioSuggestions(specialties: readonly string[]): SpecialtySuggestions {
  const matched = specialties
    .map((s) => SPECIALTY_SUGGESTIONS[s])
    .filter((s): s is SpecialtySuggestions => Boolean(s));
  if (!matched.length) return GENERAL_SUGGESTIONS;
  const unique = (lists: readonly (readonly string[])[]) => [...new Set(lists.flat())];
  return {
    conditions: unique(matched.map((m) => m.conditions)),
    services: unique(matched.map((m) => m.services)),
  };
}

/**
 * Extracts the 11-character video ID from any common YouTube URL form
 * (watch, youtu.be, shorts, embed, live, m./music. hosts). Returns null for anything else.
 */
export function parseYouTubeVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null | undefined;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (first === "shorts" || first === "embed" || first === "live" || first === "v") id = second;
  }

  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** True when `url` is https and (if the link type is restricted) on one of its allowed hosts. */
export function isAllowedPortfolioLink(key: DoctorPortfolioLinkKey, input: string): boolean {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || !url.hostname.includes(".")) return false;
  if (url.username || url.password) return false;
  const hosts = DOCTOR_PORTFOLIO_LINKS[key].hosts;
  if (!hosts) return true;
  const host = url.hostname.toLowerCase();
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}
