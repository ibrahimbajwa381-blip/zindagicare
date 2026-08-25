import { randomBytes } from "crypto";
import {
  AppointmentModel,
  connectDatabase,
  DoctorProfileModel,
  HomeVisitModel,
  PatientProfileModel,
  PaymentModel,
  UserModel,
} from "@zindagi/database";
import {
  AppointmentStatuses,
  calculateStaffNetEarnings,
  HomeVisitServiceTypes,
  HomeVisitStatuses,
  PaymentStatuses,
} from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { mapUserPii, safeDisplayText } from "@/server/lib/decrypt-pii";
import {
  getDoctorCommissionRatesByProfileId,
  resolveEffectiveCommissionPercent,
} from "./commission.service";

/** Cookie set by /r/[code] and read at signup time to attribute a new patient to a doctor. */
export const REFERRAL_COOKIE_NAME = "zc_ref";

function generateRandomCode(): string {
  return randomBytes(6).toString("base64url");
}

async function generateUniqueReferralCode(): Promise<string> {
  let code = generateRandomCode();
  while (await DoctorProfileModel.findOne(mongoFilter({ referralCode: code })).lean()) {
    code = generateRandomCode();
  }
  return code;
}

/** Returns the doctor's existing referral code, generating and persisting a new one if absent. */
export async function ensureDoctorReferralCode(doctorProfileId: string): Promise<string> {
  await connectDatabase();
  const profile = await DoctorProfileModel.findById(doctorProfileId)
    .select("referralCode")
    .lean();
  if (profile?.referralCode) return profile.referralCode;

  const code = await generateUniqueReferralCode();
  await DoctorProfileModel.findByIdAndUpdate(doctorProfileId, {
    $set: { referralCode: code },
  });
  return code;
}

/** Generates and persists a brand-new referral code, replacing any existing one. */
export async function regenerateDoctorReferralCode(doctorProfileId: string): Promise<string> {
  await connectDatabase();
  const code = await generateUniqueReferralCode();
  await DoctorProfileModel.findByIdAndUpdate(doctorProfileId, {
    $set: { referralCode: code },
  });
  return code;
}

/** Resolves a referral code (from the `zc_ref` cookie) to the referring doctor's profile id. */
export async function resolveReferralDoctorId(
  code: string | undefined | null,
): Promise<string | null> {
  if (!code?.trim()) return null;
  await connectDatabase();
  const profile = await DoctorProfileModel.findOne(
    mongoFilter({ referralCode: code.trim(), isListed: true }),
  )
    .select("_id")
    .lean();
  return profile?._id?.toString() ?? null;
}

export async function getDoctorReferralInfo(
  doctorProfileId: string,
): Promise<{ code: string; url: string }> {
  const code = await ensureDoctorReferralCode(doctorProfileId);
  return { code, url: `${siteConfig.url}/r/${code}` };
}

export type ReferredPatientRow = {
  id: string;
  name: string;
  joinedAt: string;
};

export type DoctorReferralSummary = {
  referredPatientCount: number;
  lifetimeBonusEarnings: number;
  referredPatients: ReferredPatientRow[];
};

/**
 * Summary for the doctor-facing referrals page: referred patients and the lifetime
 * commission bonus earned from them (bonus portion only, not their full earnings).
 */
export async function getReferredPatientsSummary(
  doctorProfileId: string,
): Promise<DoctorReferralSummary> {
  await connectDatabase();

  const referredPatients = await PatientProfileModel.find(
    mongoFilter({ referredByDoctorId: doctorProfileId }),
  )
    .select("_id userId referredAt")
    .sort({ referredAt: -1 })
    .lean();

  if (!referredPatients.length) {
    return { referredPatientCount: 0, lifetimeBonusEarnings: 0, referredPatients: [] };
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
  const rates = await getDoctorCommissionRatesByProfileId(doctorProfileId);

  const [completedAppts, completedHomeVisits] = await Promise.all([
    AppointmentModel.find(
      mongoFilter({
        doctorId: doctorProfileId,
        patientId: { $in: mongoObjectIds(patientIds) },
        status: AppointmentStatuses.COMPLETED,
        paymentId: { $exists: true, $ne: null },
      }),
    )
      .select("paymentId")
      .lean(),
    HomeVisitModel.find(
      mongoFilter({
        serviceType: HomeVisitServiceTypes.DOCTOR_VISIT,
        patientId: { $in: mongoObjectIds(patientIds) },
        status: HomeVisitStatuses.COMPLETED,
      }),
    )
      .select("paymentId pricing")
      .lean(),
  ]);

  const paymentIds = [
    ...new Set([
      ...completedAppts.map((a) => a.paymentId?.toString()).filter(Boolean),
      ...completedHomeVisits.map((v) => v.paymentId?.toString()).filter(Boolean),
    ]),
  ] as string[];

  const payments = paymentIds.length
    ? await PaymentModel.find(
        mongoFilter({ _id: { $in: mongoObjectIds(paymentIds) }, status: PaymentStatuses.PAID }),
      )
        .select("_id amount")
        .lean()
    : [];
  const paymentAmountById = new Map(payments.map((p) => [p._id.toString(), p.amount ?? 0]));

  // Bonus-only portion: effective% (with referral bonus) minus the doctor's base %.
  let lifetimeBonusEarnings = 0;

  for (const appt of completedAppts) {
    const gross = paymentAmountById.get(appt.paymentId?.toString() ?? "") ?? 0;
    if (!gross) continue;
    const effectivePercent = resolveEffectiveCommissionPercent(rates.online, true);
    lifetimeBonusEarnings +=
      calculateStaffNetEarnings(gross, effectivePercent) -
      calculateStaffNetEarnings(gross, rates.online);
  }

  for (const visit of completedHomeVisits) {
    const gross =
      paymentAmountById.get(visit.paymentId?.toString() ?? "") ?? visit.pricing?.total ?? 0;
    if (!gross) continue;
    const effectivePercent = resolveEffectiveCommissionPercent(rates.homeVisit, true);
    lifetimeBonusEarnings +=
      calculateStaffNetEarnings(gross, effectivePercent) -
      calculateStaffNetEarnings(gross, rates.homeVisit);
  }

  return {
    referredPatientCount: referredPatients.length,
    lifetimeBonusEarnings,
    referredPatients: referredPatientRows,
  };
}
