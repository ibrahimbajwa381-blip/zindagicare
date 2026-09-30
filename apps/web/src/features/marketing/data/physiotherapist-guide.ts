import {
  HOME_CARE_MATCH_RADIUS_KM,
  PHYSIO_HOME_VISIT_FEE_MAX,
  PHYSIO_HOME_VISIT_FEE_MIN,
  PHYSIOTHERAPY_HOME_VISIT_SPLIT,
  calculatePhysiotherapistVisitEarnings,
} from "@zindagi/shared";

const SPLIT = PHYSIOTHERAPY_HOME_VISIT_SPLIT;

export const formatRs = (amount: number) => `Rs. ${amount.toLocaleString("en-PK")}`;

/** Worked examples for the earnings section: the platform rate and a physio-set fee. */
export const PHYSIO_GUIDE_EXAMPLES = [2800, 4000].map((fee) => {
  const earns = calculatePhysiotherapistVisitEarnings(fee);
  return { fee, earns, platform: fee - earns };
});

export const PHYSIO_GUIDE_FACTS = {
  physioPercent: SPLIT.physiotherapistPercent,
  platformPercent: SPLIT.platformPercent,
  defaultFee: SPLIT.patientPays,
  feeMin: PHYSIO_HOME_VISIT_FEE_MIN,
  feeMax: PHYSIO_HOME_VISIT_FEE_MAX,
  radiusKm: HOME_CARE_MATCH_RADIUS_KM,
} as const;

export const PHYSIO_GUIDE_FAQ = [
  {
    q: "How much do I earn per home visit?",
    a: `You keep ${SPLIT.physiotherapistPercent}% of every completed home visit and ZindagiCare keeps ${SPLIT.platformPercent}% as the platform fee. On the standard ${formatRs(SPLIT.patientPays)} visit you earn ${formatRs(SPLIT.physiotherapistEarns)}. The Earnings page already shows your ${SPLIT.physiotherapistPercent}% share, not the patient's full payment.`,
  },
  {
    q: "Can I set my own fee?",
    a: `Yes. Set your fee per home visit in Profile, anywhere from ${formatRs(PHYSIO_HOME_VISIT_FEE_MIN)} to ${formatRs(PHYSIO_HOME_VISIT_FEE_MAX)}. If you leave it empty, the platform rate of ${formatRs(SPLIT.patientPays)} is used. Patients always pay your own fee, whether they book you from your profile or choose "nearest available" and are matched with you.`,
  },
  {
    q: "When do I get paid?",
    a: "Every Sunday. ZindagiCare sends your full available balance to the bank or mobile wallet account you registered, and you can see each payout — with its transfer receipt — in the Earnings page.",
  },
  {
    q: "What is the portfolio website?",
    a: "Once you are approved, you get your own public profile page at zindagicare.com/physiotherapists/your-name. It shows your photo, headline, experience, education, certifications, conditions you treat and your visit fee, with a Book home visit button. Share the link anywhere — patients who book from it are sent straight to you.",
  },
  {
    q: "Does the portfolio cost anything?",
    a: "No. The portfolio page is free for every verified physiotherapist. You only share the platform fee on visits you complete.",
  },
  {
    q: "What documents do I need to join?",
    a: "Your physiotherapy license or PPTA registration number and certificate, your CNIC number with front and back photos, your qualification (for example DPT or BS Physical Therapy), years of experience, specialties, your city and area, and a bank or wallet account for payouts. Admin reviews every application before your profile goes live.",
  },
  {
    q: "How are home visits assigned to me?",
    a: `Two ways. Patients can pick you directly from your profile or the physiotherapist directory. And when a patient asks for the nearest available physiotherapist, ZindagiCare matches them to verified physios within ${HOME_CARE_MATCH_RADIUS_KM} km of their location — so keep your location and availability up to date.`,
  },
  {
    q: "Can I stop receiving visits for a while?",
    a: "Yes. Switch the availability toggle off on your Overview page and you will not be matched to new visits. Switch it back on when you are ready.",
  },
  {
    q: "Where can I update my bank account?",
    a: "In Earnings, under Bank account. Changes apply to the next Sunday payout. Account numbers are stored encrypted.",
  },
] as const;
