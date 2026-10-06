/**
 * Limits and quick-pick suggestions for the physiotherapist public portfolio
 * (/physiotherapist/portfolio editor → /physiotherapists/[slug] public page).
 */
export const PHYSIOTHERAPIST_PORTFOLIO_LIMITS = {
  headline: 120,
  bio: 2000,
  tag: 60,
  conditionsTreated: 20,
  techniques: 20,
  languages: 8,
  memberships: 10,
  education: 8,
  experience: 10,
  certifications: 15,
  awards: 10,
  experienceDescription: 500,
} as const;

export const PORTFOLIO_MIN_YEAR = 1960;

/** Common conditions patients search for — offered as one-tap chips in the editor. */
export const PHYSIOTHERAPY_CONDITION_SUGGESTIONS = [
  "Lower back pain",
  "Neck pain",
  "Frozen shoulder",
  "Knee osteoarthritis",
  "Sciatica",
  "Slipped disc",
  "Stroke rehabilitation",
  "Sports injuries",
  "ACL reconstruction rehab",
  "Post-fracture rehab",
  "Knee / hip replacement rehab",
  "Cerebral palsy",
  "Parkinson's disease",
  "Bell's palsy",
  "Plantar fasciitis",
  "Tennis elbow",
  "Postural problems",
  "Vertigo",
  "Postnatal recovery",
  "Arthritis",
] as const;

export const PHYSIOTHERAPY_TECHNIQUE_SUGGESTIONS = [
  "Manual therapy",
  "Dry needling",
  "Kinesio taping",
  "Cupping therapy",
  "Electrotherapy (TENS / IFT)",
  "Therapeutic ultrasound",
  "Exercise therapy",
  "Mobilization & manipulation",
  "McKenzie method",
  "Mulligan concept",
  "Myofascial release",
  "Neuro-developmental therapy",
  "Gait training",
  "Hydrotherapy",
  "Chest physiotherapy",
  "Ergonomic assessment",
] as const;

export const PHYSIOTHERAPY_MEMBERSHIP_SUGGESTIONS = [
  "Pakistan Physical Therapy Association (PPTA)",
  "Allied Health Professionals Council (AHPC)",
  "World Physiotherapy",
] as const;
