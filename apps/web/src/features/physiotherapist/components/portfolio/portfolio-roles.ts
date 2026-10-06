import {
  NURSING_CONDITION_SUGGESTIONS,
  NURSING_MEMBERSHIP_SUGGESTIONS,
  NURSING_TECHNIQUE_SUGGESTIONS,
  PHYSIOTHERAPY_CONDITION_SUGGESTIONS,
  PHYSIOTHERAPY_MEMBERSHIP_SUGGESTIONS,
  PHYSIOTHERAPY_TECHNIQUE_SUGGESTIONS,
} from "@zindagi/shared";
import type { StaffPortfolioRole } from "@/lib/physiotherapists/portfolio";

export type { StaffPortfolioRole };

/** Everything in the staff portfolio UI that differs between physiotherapists and nurses. */
export type StaffPortfolioRoleConfig = {
  portfolioPath: string;
  profilePath: string;
  apiPath: string;
  focusTitle: string;
  focusDescription: string;
  focusEmpty: string;
  conditionsLabel: string;
  conditionsPlaceholder: string;
  conditionSuggestions: readonly string[];
  techniquesLabel: string;
  techniquesPlaceholder: string;
  techniqueSuggestions: readonly string[];
  membershipsPlaceholder: string;
  membershipSuggestions: readonly string[];
  headlinePlaceholder: string;
  experienceRolePlaceholder: string;
  experienceEmpty: string;
  degreePlaceholder: string;
  educationEmpty: string;
  certificationPlaceholder: string;
  certificationIssuerPlaceholder: string;
  certificationsEmpty: string;
  recognitionEmpty: string;
  /** Public profile labels for the two focus lists. */
  conditionsHeading: string;
  techniquesHeading: string;
  conditionsStatLabel: string;
};

export const STAFF_PORTFOLIO_ROLES: Record<StaffPortfolioRole, StaffPortfolioRoleConfig> = {
  physiotherapist: {
    portfolioPath: "/physiotherapist/portfolio",
    profilePath: "/physiotherapist/profile",
    apiPath: "/api/v1/physiotherapist/portfolio",
    focusTitle: "Conditions & techniques",
    focusDescription: "What you treat and how — patients search by their problem.",
    focusEmpty: "List the conditions you treat and the techniques you use.",
    conditionsLabel: "Conditions you treat",
    conditionsPlaceholder: "e.g. Lower back pain",
    conditionSuggestions: PHYSIOTHERAPY_CONDITION_SUGGESTIONS,
    techniquesLabel: "Techniques & modalities",
    techniquesPlaceholder: "e.g. Dry needling",
    techniqueSuggestions: PHYSIOTHERAPY_TECHNIQUE_SUGGESTIONS,
    membershipsPlaceholder: "e.g. PPTA",
    membershipSuggestions: PHYSIOTHERAPY_MEMBERSHIP_SUGGESTIONS,
    headlinePlaceholder: "e.g. Sports physiotherapist helping athletes return to play faster",
    experienceRolePlaceholder: "e.g. Senior Physiotherapist",
    experienceEmpty: "Add the places you've practiced physiotherapy.",
    degreePlaceholder: "e.g. Doctor of Physical Therapy (DPT)",
    educationEmpty: "Add your physiotherapy degree and any post-graduate study.",
    certificationPlaceholder: "e.g. Certified Dry Needling Practitioner",
    certificationIssuerPlaceholder: "e.g. PPTA",
    certificationsEmpty: "Add courses like dry needling, manual therapy, or kinesio taping.",
    recognitionEmpty: "Add awards you've received or associations like PPTA.",
    conditionsHeading: "Conditions treated",
    techniquesHeading: "Techniques & modalities",
    conditionsStatLabel: "conditions",
  },
  nurse: {
    portfolioPath: "/nurse/portfolio",
    profilePath: "/nurse/profile",
    apiPath: "/api/v1/nurse/portfolio",
    focusTitle: "Care & clinical skills",
    focusDescription: "The care you provide and the procedures you're skilled in.",
    focusEmpty: "List the kinds of care you provide and your clinical skills.",
    conditionsLabel: "Care you provide",
    conditionsPlaceholder: "e.g. Elderly care",
    conditionSuggestions: NURSING_CONDITION_SUGGESTIONS,
    techniquesLabel: "Clinical skills",
    techniquesPlaceholder: "e.g. IV cannulation",
    techniqueSuggestions: NURSING_TECHNIQUE_SUGGESTIONS,
    membershipsPlaceholder: "e.g. PNMC",
    membershipSuggestions: NURSING_MEMBERSHIP_SUGGESTIONS,
    headlinePlaceholder: "e.g. ICU nurse providing gentle, hospital-grade care at home",
    experienceRolePlaceholder: "e.g. Staff Nurse, ICU",
    experienceEmpty: "Add the hospitals and wards where you've worked.",
    degreePlaceholder: "e.g. BS Nursing (BSN)",
    educationEmpty: "Add your nursing degree or diploma and any post-graduate study.",
    certificationPlaceholder: "e.g. Basic Life Support (BLS)",
    certificationIssuerPlaceholder: "e.g. American Heart Association",
    certificationsEmpty: "Add courses like BLS, ACLS, IV therapy or wound care.",
    recognitionEmpty: "Add awards you've received or associations like PNMC.",
    conditionsHeading: "Care provided",
    techniquesHeading: "Clinical skills",
    conditionsStatLabel: "care areas",
  },
};
