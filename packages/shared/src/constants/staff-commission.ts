import { HomeVisitServiceTypes } from "../types/enums";
import { HOME_CARE_PRICING } from "./home-care";

/** Platform revenue share for doctors and nurses (staff keeps this % of gross). */
export const STAFF_COMMISSION_CONFIG = {
  defaultDoctorOnlinePercent: 70,
  defaultDoctorHomeVisitPercent: 70,
  defaultNursePercent: 70,
  defaultPhysiotherapistPercent: 70,
  defaultHerbalistPercent: 70,
  defaultNutritionistPercent: 70,
  /** @deprecated Use defaultDoctorOnlinePercent — kept for legacy settings reads */
  defaultDoctorPercent: 70,
  minPercent: 0,
  maxPercent: 100,
  /** Bonus revenue-share points a doctor earns on appointments with patients they referred. */
  referralBonusPercent: 15,
} as const;

export type DoctorCommissionChannel = "online" | "home_visit";

export function calculateStaffNetEarnings(
  grossAmount: number,
  commissionPercent: number,
): number {
  if (!grossAmount || grossAmount <= 0) return 0;
  const clamped = Math.min(
    STAFF_COMMISSION_CONFIG.maxPercent,
    Math.max(STAFF_COMMISSION_CONFIG.minPercent, commissionPercent),
  );
  return Math.round((grossAmount * clamped) / 100);
}

/**
 * Standard physiotherapy home-visit split: the physiotherapist keeps 70% of the visit fee and
 * ZindagiCare keeps 30%. The rupee amounts are for the default visit fee; physiotherapists who
 * set their own fee get the same percentage of that fee.
 */
export const PHYSIOTHERAPY_HOME_VISIT_SPLIT = (() => {
  const physiotherapistPercent = STAFF_COMMISSION_CONFIG.defaultPhysiotherapistPercent;
  const patientPays = HOME_CARE_PRICING[HomeVisitServiceTypes.PHYSIOTHERAPY];
  const physiotherapistEarns = calculateStaffNetEarnings(patientPays, physiotherapistPercent);
  return {
    physiotherapistPercent,
    platformPercent: 100 - physiotherapistPercent,
    patientPays,
    physiotherapistEarns,
    platformFee: patientPays - physiotherapistEarns,
  } as const;
})();

/**
 * A physiotherapist's share of one completed visit: 70% of the fee, unless admin has set a
 * per-physiotherapist override percentage.
 */
export function calculatePhysiotherapistVisitEarnings(
  grossAmount: number,
  commissionOverride?: number | null,
): number {
  const percent =
    commissionOverride != null && !Number.isNaN(commissionOverride)
      ? commissionOverride
      : PHYSIOTHERAPY_HOME_VISIT_SPLIT.physiotherapistPercent;
  return calculateStaffNetEarnings(grossAmount, percent);
}

/** Adds the referral bonus to a doctor's base commission % when the patient was referred by them. */
export function applyReferralBonus(
  basePercent: number,
  isReferred: boolean,
): number {
  if (!isReferred) return basePercent;
  return Math.min(
    STAFF_COMMISSION_CONFIG.maxPercent,
    basePercent + STAFF_COMMISSION_CONFIG.referralBonusPercent,
  );
}
