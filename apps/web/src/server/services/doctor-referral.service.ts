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
import { REFERRAL_COOKIE_NAME } from "@/lib/doctors/referral-cookie";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { mapUserPii, safeDisplayText } from "@/server/lib/decrypt-pii";
import {
  getDoctorCommissionRatesByProfileId,
  resolveEffectiveCommissionPercent,
} from "./commission.service";

export { REFERRAL_COOKIE_NAME };

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

/**
 * Attributes a patient to a doctor at booking time, not just signup — covers patients
 * who already had an account before clicking the doctor's referral link (the common
 * case in practice) as well as brand-new signups whose referral capture at registration
 * time was for some reason missed. First referral wins: never overwrites an existing
 * `referredByDoctorId`, and only attributes when the referral cookie's doctor matches
 * the doctor actually being booked (so browsing one doctor's link doesn't tag a booking
 * with a different doctor).
 */
export async function attributeReferralIfEligible(
  patientUserId: string,
  bookedDoctorProfileId: string,
  referralCode: string | undefined | null,
): Promise<void> {
  const referredDoctorId = await resolveReferralDoctorId(referralCode);
  if (!referredDoctorId || referredDoctorId !== bookedDoctorProfileId) return;

  await connectDatabase();
  await PatientProfileModel.updateOne(
    mongoFilter({ userId: patientUserId, referredByDoctorId: null }),
    { $set: { referredByDoctorId: referredDoctorId, referredAt: new Date() } },
  );
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

  const doctorProfile = await DoctorProfileModel.findById(doctorProfileId)
    .select("userId")
    .lean();
  const doctorUserId = doctorProfile?.userId?.toString();

  // Appointment/HomeVisit `patientId` references User, not PatientProfile. HomeVisit has
  // no `doctorId` — it's scoped to this doctor via `assignedStaffId` (a User id), not by
  // service type alone, otherwise a home visit assigned to a *different* doctor for the
  // same patient would be miscounted here.
  const [completedAppts, completedHomeVisits] = await Promise.all([
    AppointmentModel.find(
      mongoFilter({
        doctorId: doctorProfileId,
        patientId: { $in: mongoObjectIds(userIds) },
        status: AppointmentStatuses.COMPLETED,
        paymentId: { $exists: true, $ne: null },
      }),
    )
      .select("paymentId")
      .lean(),
    doctorUserId
      ? HomeVisitModel.find(
          mongoFilter({
            serviceType: HomeVisitServiceTypes.DOCTOR_VISIT,
            assignedStaffId: doctorUserId,
            patientId: { $in: mongoObjectIds(userIds) },
            status: HomeVisitStatuses.COMPLETED,
          }),
        )
          .select("paymentId pricing")
          .lean()
      : [],
  ]);
  const rates = await getDoctorCommissionRatesByProfileId(doctorProfileId);

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
