import { randomBytes } from "crypto";
import {
  AppointmentModel,
  connectDatabase,
  PatientProfileModel,
  PaymentModel,
  UserModel,
} from "@zindagi/database";
import {
  AppointmentStatuses,
  PaymentStatuses,
  calculateStaffNetEarnings,
} from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { mapUserPii, safeDisplayText } from "@/server/lib/decrypt-pii";
import {
  resolveEffectiveCommissionPercent,
  type ProviderCommissionRates,
} from "../commission.service";

export type ReferredPatientRow = {
  id: string;
  name: string;
  joinedAt: string;
};

export type ReferralSummary = {
  referredPatientCount: number;
  lifetimeBonusEarnings: number;
  referredPatients: ReferredPatientRow[];
};

interface ReferralCodeModel {
  findOne(filter: Record<string, unknown>): { lean(): Promise<unknown> };
  findById(id: string): {
    select(fields: string): { lean(): Promise<{ referralCode?: string | null } | null> };
  };
  findByIdAndUpdate(id: string, update: Record<string, unknown>): unknown;
}

/**
 * Shared implementation behind each role's `*-referral.service.ts` — identical logic across
 * roles, differing only in the profile model, the patient "referred by" field, the provider
 * role tag on appointments, and how commission rates are looked up.
 */
export function createReferralService(config: {
  Model: ReferralCodeModel;
  referredByField: string;
  providerRole: string;
  getCommissionRates: (profileId: string) => Promise<ProviderCommissionRates>;
}) {
  function generateRandomCode(): string {
    return randomBytes(6).toString("base64url");
  }

  async function generateUniqueReferralCode(): Promise<string> {
    let code = generateRandomCode();
    while (
      await config.Model.findOne(mongoFilter({ referralCode: code })).lean()
    ) {
      code = generateRandomCode();
    }
    return code;
  }

  /** Returns the profile's referral code, generating and persisting one if absent. */
  async function ensureReferralCode(profileId: string): Promise<string> {
    await connectDatabase();
    const profile = await config.Model.findById(profileId)
      .select("referralCode")
      .lean();
    if (profile?.referralCode) return profile.referralCode;

    const code = await generateUniqueReferralCode();
    await config.Model.findByIdAndUpdate(profileId, {
      $set: { referralCode: code },
    });
    return code;
  }

  /** Generates and persists a brand-new referral code, replacing any existing one. */
  async function regenerateReferralCode(profileId: string): Promise<string> {
    await connectDatabase();
    const code = await generateUniqueReferralCode();
    await config.Model.findByIdAndUpdate(profileId, {
      $set: { referralCode: code },
    });
    return code;
  }

  /** Resolves a referral code (from the `zc_ref` cookie) to a profile id. */
  async function resolveReferralProfileId(
    code: string | undefined | null,
  ): Promise<string | null> {
    if (!code?.trim()) return null;
    await connectDatabase();
    const profile = (await config.Model.findOne(
      mongoFilter({ referralCode: code.trim(), isListed: true }),
    ).lean()) as { _id?: { toString(): string } } | null;
    return profile?._id?.toString() ?? null;
  }

  async function getReferralInfo(
    profileId: string,
  ): Promise<{ code: string; url: string }> {
    const code = await ensureReferralCode(profileId);
    return { code, url: `${siteConfig.url}/r/${code}` };
  }

  /**
   * Referrals page summary: patients who signed up through this provider's link and the
   * provider's lifetime full earnings (at the boosted referral rate) from them.
   */
  async function getReferredPatientsSummary(
    profileId: string,
  ): Promise<ReferralSummary> {
    await connectDatabase();

    const referredPatients = await PatientProfileModel.find(
      mongoFilter({ [config.referredByField]: profileId }),
    )
      .select("_id userId referredAt")
      .sort({ referredAt: -1 })
      .lean();

    if (!referredPatients.length) {
      return {
        referredPatientCount: 0,
        lifetimeBonusEarnings: 0,
        referredPatients: [],
      };
    }

    const userIds = referredPatients
      .map((p) => p.userId?.toString())
      .filter((id): id is string => Boolean(id));
    const users = userIds.length
      ? await UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(userIds) } }))
          .select("name")
          .lean()
      : [];
    const userById = new Map(users.map((u) => [u._id.toString(), u]));

    const referredPatientRows: ReferredPatientRow[] = referredPatients.map((p) => {
      const user = userById.get(p.userId?.toString() ?? "");
      return {
        id: p._id.toString(),
        name: safeDisplayText(mapUserPii(user ?? {}).name) ?? "Patient",
        joinedAt: (p.referredAt ?? new Date()).toISOString(),
      };
    });

    const patientIds = referredPatients.map((p) => p._id.toString());
    const rates = await config.getCommissionRates(profileId);

    const completedAppts = await AppointmentModel.find(
      mongoFilter({
        providerRole: config.providerRole,
        providerProfileId: profileId,
        patientId: { $in: mongoObjectIds(patientIds) },
        status: AppointmentStatuses.COMPLETED,
        paymentId: { $exists: true, $ne: null },
      }),
    )
      .select("paymentId")
      .lean();

    const paymentIds = [
      ...new Set(
        completedAppts
          .map((a) => a.paymentId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const payments = paymentIds.length
      ? await PaymentModel.find(
          mongoFilter({
            _id: { $in: mongoObjectIds(paymentIds) },
            status: PaymentStatuses.PAID,
          }),
        )
          .select("_id amount")
          .lean()
      : [];
    const paymentAmountById = new Map(
      payments.map((p) => [p._id.toString(), p.amount ?? 0]),
    );

    // Full earnings (at the boosted referral rate) from appointments with referred patients.
    let lifetimeBonusEarnings = 0;
    const effectivePercent = resolveEffectiveCommissionPercent(rates.online, true);

    for (const appt of completedAppts) {
      const gross = paymentAmountById.get(appt.paymentId?.toString() ?? "") ?? 0;
      if (!gross) continue;
      lifetimeBonusEarnings += calculateStaffNetEarnings(gross, effectivePercent);
    }

    return {
      referredPatientCount: referredPatients.length,
      lifetimeBonusEarnings,
      referredPatients: referredPatientRows,
    };
  }

  return {
    ensureReferralCode,
    regenerateReferralCode,
    resolveReferralProfileId,
    getReferralInfo,
    getReferredPatientsSummary,
  };
}
