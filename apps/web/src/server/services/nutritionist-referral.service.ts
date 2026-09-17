import { NutritionistProfileModel } from "@zindagi/database";
import { NUTRITIONIST_PROVIDER_ROLE } from "./nutritionist-dashboard.service";
import { getNutritionistCommissionRatesByProfileId } from "./commission.service";
import {
  createReferralService,
  type ReferralSummary,
  type ReferredPatientRow,
} from "./shared/referral.service";

const referrals = createReferralService({
  Model: NutritionistProfileModel,
  referredByField: "referredByNutritionistId",
  providerRole: NUTRITIONIST_PROVIDER_ROLE,
  getCommissionRates: getNutritionistCommissionRatesByProfileId,
});

export type NutritionistReferredPatientRow = ReferredPatientRow;
export type NutritionistReferralSummary = ReferralSummary;

/** Returns the nutritionist's referral code, generating and persisting one if absent. */
export const ensureNutritionistReferralCode = referrals.ensureReferralCode;

/** Generates and persists a brand-new referral code, replacing any existing one. */
export const regenerateNutritionistReferralCode = referrals.regenerateReferralCode;

/** Resolves a referral code (from the `zc_ref` cookie) to a nutritionist profile id. */
export const resolveReferralNutritionistId = referrals.resolveReferralProfileId;

export const getNutritionistReferralInfo = referrals.getReferralInfo;

/**
 * Referrals page summary: patients who signed up through this nutritionist's link and
 * the nutritionist's lifetime full earnings (at the boosted referral rate) from them.
 */
export const getNutritionistReferredPatientsSummary = referrals.getReferredPatientsSummary;
