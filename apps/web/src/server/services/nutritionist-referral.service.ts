import { randomBytes } from "crypto";
import {
  AppointmentModel,
  connectDatabase,
  NutritionistProfileModel,
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
import { NUTRITIONIST_PROVIDER_ROLE } from "./nutritionist-dashboard.service";
import {
  getNutritionistCommissionRatesByProfileId,
  resolveEffectiveCommissionPercent,
} from "./commission.service";

function generateRandomCode(): string {
  return randomBytes(6).toString("base64url");
}

async function generateUniqueReferralCode(): Promise<string> {
  let code = generateRandomCode();
  while (
    await NutritionistProfileModel.findOne(
      mongoFilter({ referralCode: code }),
    ).lean()
  ) {
    code = generateRandomCode();
  }
  return code;
}

/** Returns the nutritionist's referral code, generating and persisting one if absent. */
export async function ensureNutritionistReferralCode(
  nutritionistProfileId: string,
): Promise<string> {
  await connectDatabase();
  const profile = await NutritionistProfileModel.findById(nutritionistProfileId)
    .select("referralCode")
    .lean();
  if (profile?.referralCode) return profile.referralCode;

  const code = await generateUniqueReferralCode();
  await NutritionistProfileModel.findByIdAndUpdate(nutritionistProfileId, {
    $set: { referralCode: code },
  });
  return code;
}

/** Generates and persists a brand-new referral code, replacing any existing one. */
export async function regenerateNutritionistReferralCode(
  nutritionistProfileId: string,
): Promise<string> {
  await connectDatabase();
  const code = await generateUniqueReferralCode();
  await NutritionistProfileModel.findByIdAndUpdate(nutritionistProfileId, {
    $set: { referralCode: code },
  });
  return code;
}

/** Resolves a referral code (from the `zc_ref` cookie) to a nutritionist profile id. */
export async function resolveReferralNutritionistId(
  code: string | undefined | null,
): Promise<string | null> {
  if (!code?.trim()) return null;
  await connectDatabase();
  const profile = await NutritionistProfileModel.findOne(
    mongoFilter({ referralCode: code.trim(), isListed: true }),
  )
    .select("_id")
    .lean();
  return profile?._id?.toString() ?? null;
}

export async function getNutritionistReferralInfo(
  nutritionistProfileId: string,
): Promise<{ code: string; url: string }> {
  const code = await ensureNutritionistReferralCode(nutritionistProfileId);
  return { code, url: `${siteConfig.url}/r/${code}` };
}

export type NutritionistReferredPatientRow = {
  id: string;
  name: string;
  joinedAt: string;
};

export type NutritionistReferralSummary = {
  referredPatientCount: number;
  lifetimeBonusEarnings: number;
  referredPatients: NutritionistReferredPatientRow[];
};

/**
 * Referrals page summary: patients who signed up through this nutritionist's link and
 * the nutritionist's lifetime full earnings (at the boosted referral rate) from them.
 */
export async function getNutritionistReferredPatientsSummary(
  nutritionistProfileId: string,
): Promise<NutritionistReferralSummary> {
  await connectDatabase();

  const referredPatients = await PatientProfileModel.find(
    mongoFilter({ referredByNutritionistId: nutritionistProfileId }),
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

  const referredPatientRows: NutritionistReferredPatientRow[] =
    referredPatients.map((p) => {
      const user = userById.get(p.userId?.toString() ?? "");
      return {
        id: p._id.toString(),
        name: safeDisplayText(mapUserPii(user ?? {}).name) ?? "Patient",
        joinedAt: (p.referredAt ?? new Date()).toISOString(),
      };
    });

  const patientIds = referredPatients.map((p) => p._id.toString());
  const rates = await getNutritionistCommissionRatesByProfileId(nutritionistProfileId);

  const completedAppts = await AppointmentModel.find(
    mongoFilter({
      providerRole: NUTRITIONIST_PROVIDER_ROLE,
      providerProfileId: nutritionistProfileId,
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
