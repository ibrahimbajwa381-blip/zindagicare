/** Platform revenue share for doctors and nurses (staff keeps this % of gross). */
export const STAFF_COMMISSION_CONFIG = {
  defaultDoctorOnlinePercent: 70,
  defaultDoctorHomeVisitPercent: 70,
  defaultNursePercent: 70,
  defaultPhysiotherapistPercent: 70,
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
