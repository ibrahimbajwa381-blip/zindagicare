import { HerbalistProfileModel } from "@zindagi/database";
import { HERBALIST_PROVIDER_ROLE } from "./herbalist-dashboard.service";
import { getHerbalistCommissionRatesByProfileId } from "./commission.service";
import {
  createReferralService,
  type ReferralSummary,
  type ReferredPatientRow,
} from "./shared/referral.service";

const referrals = createReferralService({
  Model: HerbalistProfileModel,
  referredByField: "referredByHerbalistId",
  providerRole: HERBALIST_PROVIDER_ROLE,
  getCommissionRates: getHerbalistCommissionRatesByProfileId,
});

export type HerbalistReferredPatientRow = ReferredPatientRow;
export type HerbalistReferralSummary = ReferralSummary;

/** Returns the herbalist's referral code, generating and persisting one if absent. */
export const ensureHerbalistReferralCode = referrals.ensureReferralCode;

/** Generates and persists a brand-new referral code, replacing any existing one. */
export const regenerateHerbalistReferralCode = referrals.regenerateReferralCode;

/** Resolves a referral code (from the `zc_ref` cookie) to a herbalist profile id. */
export const resolveReferralHerbalistId = referrals.resolveReferralProfileId;

export const getHerbalistReferralInfo = referrals.getReferralInfo;

/**
 * Referrals page summary: patients who signed up through this herbalist's link and
 * the herbalist's lifetime full earnings (at the boosted referral rate) from them.
 */
export const getHerbalistReferredPatientsSummary = referrals.getReferredPatientsSummary;
