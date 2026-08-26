import { randomBytes } from "crypto";
import {
  AppointmentModel,
  connectDatabase,
  HerbalistProfileModel,
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
import { HERBALIST_PROVIDER_ROLE } from "./herbalist-dashboard.service";
import {
  getHerbalistCommissionRatesByProfileId,
  resolveEffectiveCommissionPercent,
} from "./commission.service";

function generateRandomCode(): string {
  return randomBytes(6).toString("base64url");
}

async function generateUniqueReferralCode(): Promise<string> {
  let code = generateRandomCode();
  while (
    await HerbalistProfileModel.findOne(
      mongoFilter({ referralCode: code }),
    ).lean()
  ) {
    code = generateRandomCode();
  }
  return code;
}

/** Returns the herbalist's referral code, generating and persisting one if absent. */
export async function ensureHerbalistReferralCode(
  herbalistProfileId: string,
): Promise<string> {
  await connectDatabase();
  const profile = await HerbalistProfileModel.findById(herbalistProfileId)
    .select("referralCode")
    .lean();
  if (profile?.referralCode) return profile.referralCode;

  const code = await generateUniqueReferralCode();
  await HerbalistProfileModel.findByIdAndUpdate(herbalistProfileId, {
    $set: { referralCode: code },
  });
  return code;
}

/** Generates and persists a brand-new referral code, replacing any existing one. */
export async function regenerateHerbalistReferralCode(
  herbalistProfileId: string,
): Promise<string> {
  await connectDatabase();
  const code = await generateUniqueReferralCode();
  await HerbalistProfileModel.findByIdAndUpdate(herbalistProfileId, {
    $set: { referralCode: code },
  });
  return code;
}

/** Resolves a referral code (from the `zc_ref` cookie) to a herbalist profile id. */
export async function resolveReferralHerbalistId(
  code: string | undefined | null,
): Promise<string | null> {
  if (!code?.trim()) return null;
  await connectDatabase();
  const profile = await HerbalistProfileModel.findOne(
    mongoFilter({ referralCode: code.trim(), isListed: true }),
  )
    .select("_id")
    .lean();
  return profile?._id?.toString() ?? null;
}

export async function getHerbalistReferralInfo(
  herbalistProfileId: string,
): Promise<{ code: string; url: string }> {
  const code = await ensureHerbalistReferralCode(herbalistProfileId);
  return { code, url: `${siteConfig.url}/r/${code}` };
}

export type HerbalistReferredPatientRow = {
  id: string;
  name: string;
  joinedAt: string;
};

export type HerbalistReferralSummary = {
  referredPatientCount: number;
  lifetimeBonusEarnings: number;
  referredPatients: HerbalistReferredPatientRow[];
};

/**
 * Referrals page summary: patients who signed up through this herbalist's link and
 * the lifetime commission bonus earned from them (bonus portion only).
 */
export async function getHerbalistReferredPatientsSummary(
  herbalistProfileId: string,
): Promise<HerbalistReferralSummary> {
  await connectDatabase();

  const referredPatients = await PatientProfileModel.find(
    mongoFilter({ referredByHerbalistId: herbalistProfileId }),
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

  const referredPatientRows: HerbalistReferredPatientRow[] =
    referredPatients.map((p) => {
      const user = userById.get(p.userId?.toString() ?? "");
      return {
        id: p._id.toString(),
        name: safeDisplayText(mapUserPii(user ?? {}).name) ?? "Patient",
        joinedAt: (p.referredAt ?? new Date()).toISOString(),
      };
    });

  const patientIds = referredPatients.map((p) => p._id.toString());
  const rates = await getHerbalistCommissionRatesByProfileId(herbalistProfileId);

  const completedAppts = await AppointmentModel.find(
    mongoFilter({
      providerRole: HERBALIST_PROVIDER_ROLE,
      providerProfileId: herbalistProfileId,
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

  // Bonus-only portion: effective% (with referral bonus) minus the base %.
  let lifetimeBonusEarnings = 0;
  const effectivePercent = resolveEffectiveCommissionPercent(rates.online, true);

  for (const appt of completedAppts) {
    const gross = paymentAmountById.get(appt.paymentId?.toString() ?? "") ?? 0;
    if (!gross) continue;
    lifetimeBonusEarnings +=
      calculateStaffNetEarnings(gross, effectivePercent) -
      calculateStaffNetEarnings(gross, rates.online);
  }

  return {
    referredPatientCount: referredPatients.length,
    lifetimeBonusEarnings,
    referredPatients: referredPatientRows,
  };
}
