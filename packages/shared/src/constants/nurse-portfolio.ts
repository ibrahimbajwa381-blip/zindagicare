import { PHYSIOTHERAPIST_PORTFOLIO_LIMITS } from "./physiotherapist-portfolio";

/**
 * Limits and quick-pick suggestions for the nurse public portfolio
 * (/nurse/portfolio editor → /nurses/[slug] public page). Same shape and limits as the
 * physiotherapist portfolio — both live on StaffProfile.portfolio.
 */
export const NURSE_PORTFOLIO_LIMITS = PHYSIOTHERAPIST_PORTFOLIO_LIMITS;

/** Care patients ask for — stored in `conditionsTreated`. */
export const NURSING_CONDITION_SUGGESTIONS = [
  "Elderly care",
  "Post-operative care",
  "Bedridden patient care",
  "Bedsore prevention & care",
  "Diabetic foot care",
  "Stroke recovery care",
  "Dementia / Alzheimer's care",
  "Cancer care",
  "Palliative care",
  "Newborn & mother care",
  "Chronic wound care",
  "Tracheostomy care",
  "Dialysis support",
  "Cardiac patient care",
  "Fever & infection monitoring",
] as const;

/** Clinical skills — stored in `techniques`. */
export const NURSING_TECHNIQUE_SUGGESTIONS = [
  "IV cannulation",
  "IV drip administration",
  "Injections (IM / IV / SC)",
  "Wound dressing",
  "Catheter care",
  "NG tube insertion & feeding",
  "Vital signs monitoring",
  "Blood sugar monitoring",
  "Medication administration",
  "Oxygen therapy",
  "Nebulization",
  "Suctioning",
  "ECG",
  "Blood sample collection",
  "Stoma care",
] as const;

export const NURSING_MEMBERSHIP_SUGGESTIONS = [
  "Pakistan Nursing & Midwifery Council (PNMC)",
  "Pakistan Nurses Federation",
  "Young Nurses Association Pakistan",
] as const;
