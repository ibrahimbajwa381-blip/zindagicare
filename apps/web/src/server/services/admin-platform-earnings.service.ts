import {
  connectDatabase,
  AppointmentModel,
  DoctorPayoutModel,
  DoctorProfileModel,
  HomeVisitModel,
  PaymentModel,
  SundayFreeRequestModel,
  UserModel,
  VideoSessionModel,
} from "@zindagi/database";
import {
  AppointmentStatuses,
  HomeVisitServiceTypes,
  HomeVisitStatuses,
  PaymentStatuses,
  VerificationStatuses,
  calculateStaffNetEarnings,
} from "@zindagi/shared";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { mapUserPii, safeDisplayText } from "@/server/lib/decrypt-pii";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import {
  getDoctorCommissionRatesByProfileIds,
  getReferredPatientDoctorMap,
  resolveEffectiveCommissionPercent,
} from "./commission.service";

export type PlatformEarningsDoctorRow = {
  id: string;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  consultCount: number;
  grossRevenue: number;
  doctorEarnings: number;
  platformCommission: number;
  totalPaidOut: number;
  balanceDue: number;
  platformOnlineCommissionPercent: number;
  platformHomeVisitCommissionPercent: number;
  /** Patients who signed up via this doctor's referral link. */
  referredPatientCount: number;
};

export type UnresolvedPaymentRow = {
  appointmentId: string;
  scheduledStart: string;
  status: string;
  doctorId?: string;
  doctorName: string;
  patientName: string;
  amountPkr: number;
  daysSinceScheduled: number;
};

export type AdminPlatformEarningsOverview = {
  totals: {
    grossRevenue: number;
    grossRevenueThisMonth: number;
    doctorEarnings: number;
    doctorEarningsThisMonth: number;
    platformCommission: number;
    platformCommissionThisMonth: number;
    consultCount: number;
  };
  byDoctor: PlatformEarningsDoctorRow[];
  unresolvedPayments: UnresolvedPaymentRow[];
  unresolvedPaymentsTotal: number;
};

const EMPTY_ROW = () => ({
  grossRevenue: 0,
  grossRevenueThisMonth: 0,
  doctorEarnings: 0,
  doctorEarningsThisMonth: 0,
  consultCount: 0,
});

export async function getAdminPlatformEarnings(): Promise<AdminPlatformEarningsOverview> {
  await connectDatabase();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const profiles = await DoctorProfileModel.find(
    mongoFilter({
      verificationStatus: VerificationStatuses.APPROVED,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }),
  )
    .select("userId specialties")
    .lean();

  const profileIds = profiles.map((p) => p._id.toString());
  const userIds = profiles.map((p) => p.userId?.toString()).filter(Boolean) as string[];

  const profileIdByUserId = new Map(
    profiles
      .map((p) => [p.userId?.toString() ?? "", p._id.toString()] as const)
      .filter(([userId]) => Boolean(userId)),
  );

  const [users, rates, completedAppointments, completedHomeVisits] = await Promise.all([
    userIds.length
      ? UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(userIds) } }))
          .select("name avatarUrl")
          .lean()
      : [],
    getDoctorCommissionRatesByProfileIds(profileIds),
    AppointmentModel.find(
      mongoFilter({
        doctorId: { $in: mongoObjectIds(profileIds) },
        status: AppointmentStatuses.COMPLETED,
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      }),
    )
      .select("doctorId patientId paymentId completedAt")
      .lean(),
    HomeVisitModel.find(
      mongoFilter({
        serviceType: HomeVisitServiceTypes.DOCTOR_VISIT,
        assignedStaffId: { $in: userIds },
        status: HomeVisitStatuses.COMPLETED,
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      }),
    )
      .select("assignedStaffId patientId paymentId pricing completedAt")
      .lean(),
  ]);

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  // Sunday-free-consult appointments assigned before the appointment/payment link was
  // wired up only carry the contribution payment on SundayFreeRequest.paymentId — backfill
  // it here so historical consults still count toward revenue and doctor earnings.
  const unlinkedAppointmentIds = completedAppointments
    .filter((a) => !a.paymentId)
    .map((a) => a._id.toString());
  if (unlinkedAppointmentIds.length) {
    const linkedRequests = await SundayFreeRequestModel.find(
      mongoFilter({
        appointmentId: { $in: mongoObjectIds(unlinkedAppointmentIds) },
        paymentId: { $exists: true, $ne: null },
      }),
    )
      .select("appointmentId paymentId")
      .lean();
    const paymentIdByAppointmentId = new Map(
      linkedRequests.map((r) => [r.appointmentId?.toString(), r.paymentId?.toString()]),
    );
    for (const a of completedAppointments as Array<{
      _id: { toString(): string };
      paymentId?: unknown;
    }>) {
      if (a.paymentId) continue;
      const paymentId = paymentIdByAppointmentId.get(a._id.toString());
      if (paymentId) a.paymentId = paymentId;
    }
  }

  const paymentIds = [
    ...new Set([
      ...completedAppointments.map((a) => a.paymentId?.toString()).filter(Boolean),
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

  const payouts = profileIds.length
    ? await DoctorPayoutModel.find(mongoFilter({ doctorProfileId: { $in: mongoObjectIds(profileIds) } }))
        .select("doctorProfileId amount")
        .lean()
    : [];
  const paidOutByProfile = new Map<string, number>();
  for (const payout of payouts) {
    const profileId = payout.doctorProfileId?.toString();
    if (!profileId) continue;
    paidOutByProfile.set(profileId, (paidOutByProfile.get(profileId) ?? 0) + (payout.amount ?? 0));
  }

  const referredPatientDoctorMap = await getReferredPatientDoctorMap(profileIds);
  const referredCountByProfile = new Map<string, number>();
  for (const doctorId of referredPatientDoctorMap.values()) {
    referredCountByProfile.set(doctorId, (referredCountByProfile.get(doctorId) ?? 0) + 1);
  }

  const rowsByProfile = new Map(profileIds.map((id) => [id, EMPTY_ROW()]));

  for (const appt of completedAppointments) {
    const profileId = appt.doctorId?.toString();
    const paymentId = appt.paymentId?.toString();
    if (!profileId || !paymentId) continue;
    const gross = paymentAmountById.get(paymentId);
    if (!gross) continue;

    const rate = rates.get(profileId) ?? { online: 70, homeVisit: 70 };
    const isReferred = referredPatientDoctorMap.get(appt.patientId?.toString() ?? "") === profileId;
    const net = calculateStaffNetEarnings(
      gross,
      resolveEffectiveCommissionPercent(rate.online, isReferred),
    );

    const row = rowsByProfile.get(profileId) ?? EMPTY_ROW();
    row.grossRevenue += gross;
    row.doctorEarnings += net;
    row.consultCount += 1;
    if (appt.completedAt && appt.completedAt >= startOfMonth) {
      row.grossRevenueThisMonth += gross;
      row.doctorEarningsThisMonth += net;
    }
    rowsByProfile.set(profileId, row);
  }

  for (const visit of completedHomeVisits) {
    const staffUserId = visit.assignedStaffId?.toString();
    const profileId = staffUserId ? profileIdByUserId.get(staffUserId) : undefined;
    if (!profileId) continue;
    const paymentId = visit.paymentId?.toString();
    const gross = paymentId
      ? (paymentAmountById.get(paymentId) ?? visit.pricing?.total ?? 0)
      : (visit.pricing?.total ?? 0);
    if (!gross) continue;

    const rate = rates.get(profileId) ?? { online: 70, homeVisit: 70 };
    const isReferred = referredPatientDoctorMap.get(visit.patientId?.toString() ?? "") === profileId;
    const net = calculateStaffNetEarnings(
      gross,
      resolveEffectiveCommissionPercent(rate.homeVisit, isReferred),
    );

    const row = rowsByProfile.get(profileId) ?? EMPTY_ROW();
    row.grossRevenue += gross;
    row.doctorEarnings += net;
    row.consultCount += 1;
    if (visit.completedAt && visit.completedAt >= startOfMonth) {
      row.grossRevenueThisMonth += gross;
      row.doctorEarningsThisMonth += net;
    }
    rowsByProfile.set(profileId, row);
  }

  const byDoctor: PlatformEarningsDoctorRow[] = profiles
    .map((profile) => {
      const id = profile._id.toString();
      const row = rowsByProfile.get(id) ?? EMPTY_ROW();
      const user = userMap.get(profile.userId?.toString() ?? "");
      const pii = mapUserPii(user ?? {});
      const rate = rates.get(id) ?? { online: 70, homeVisit: 70 };
      const totalPaidOut = paidOutByProfile.get(id) ?? 0;

      return {
        id,
        name: pii.name,
        avatarUrl: resolveDoctorPortrait(pii.name, user?.avatarUrl),
        specialties: profile.specialties ?? [],
        consultCount: row.consultCount,
        grossRevenue: row.grossRevenue,
        doctorEarnings: row.doctorEarnings,
        platformCommission: row.grossRevenue - row.doctorEarnings,
        totalPaidOut,
        balanceDue: Math.max(row.doctorEarnings - totalPaidOut, 0),
        platformOnlineCommissionPercent: 100 - rate.online,
        platformHomeVisitCommissionPercent: 100 - rate.homeVisit,
        referredPatientCount: referredCountByProfile.get(id) ?? 0,
      };
    })
    .filter((row) => row.consultCount > 0)
    .sort((a, b) => b.platformCommission - a.platformCommission);

  const totals = byDoctor.reduce(
    (acc, row) => {
      acc.grossRevenue += row.grossRevenue;
      acc.doctorEarnings += row.doctorEarnings;
      acc.platformCommission += row.platformCommission;
      acc.consultCount += row.consultCount;
      return acc;
    },
    { grossRevenue: 0, doctorEarnings: 0, platformCommission: 0, consultCount: 0 },
  );

  const monthTotals = [...rowsByProfile.values()].reduce(
    (acc, row) => {
      acc.grossRevenueThisMonth += row.grossRevenueThisMonth;
      acc.doctorEarningsThisMonth += row.doctorEarningsThisMonth;
      return acc;
    },
    { grossRevenueThisMonth: 0, doctorEarningsThisMonth: 0 },
  );

  const unresolvedCandidates = await AppointmentModel.find(
    mongoFilter({
      paymentId: { $exists: true, $ne: null },
      status: {
        $in: [
          AppointmentStatuses.PENDING,
          AppointmentStatuses.CONFIRMED,
          AppointmentStatuses.IN_PROGRESS,
        ],
      },
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }),
  )
    .populate("patientId", "name")
    .populate({
      path: "doctorId",
      select: "userId specialties",
      populate: { path: "userId", select: "name" },
    })
    .populate("paymentId", "amount status")
    .sort({ scheduledStart: -1 })
    .limit(200)
    .lean();

  const paidUnresolved = unresolvedCandidates.filter((a) => {
    const payment = a.paymentId as { status?: string } | null;
    return payment?.status === PaymentStatuses.PAID;
  });

  const unresolvedAppointmentIds = paidUnresolved.map((a) => a._id.toString());
  const unresolvedVideoSessions = unresolvedAppointmentIds.length
    ? await VideoSessionModel.find(
        mongoFilter({ appointmentId: { $in: unresolvedAppointmentIds } }),
      )
        .select("appointmentId patientJoinedAt doctorJoinedAt")
        .lean()
    : [];
  const videoSessionByAppointment = new Map(
    unresolvedVideoSessions.map((v) => [v.appointmentId?.toString() ?? "", v]),
  );

  const nowMs = Date.now();
  const unresolvedPayments: UnresolvedPaymentRow[] = paidUnresolved
    .filter((a) => {
      const session = videoSessionByAppointment.get(a._id.toString());
      return !session?.patientJoinedAt && !session?.doctorJoinedAt;
    })
    .map((a) => {
      const patient = a.patientId as { name?: string } | null;
      const doctorProfile = a.doctorId as {
        _id?: { toString(): string };
        userId?: { name?: string };
      } | null;
      const payment = a.paymentId as { amount?: number } | null;

      return {
        appointmentId: a._id.toString(),
        scheduledStart: a.scheduledStart.toISOString(),
        status: a.status,
        doctorId: doctorProfile?._id?.toString(),
        doctorName: safeDisplayText(doctorProfile?.userId?.name) ?? "Doctor",
        patientName: safeDisplayText(patient?.name) ?? "Patient",
        amountPkr: payment?.amount ?? 0,
        daysSinceScheduled: Math.max(
          0,
          Math.floor((nowMs - a.scheduledStart.getTime()) / (24 * 60 * 60 * 1000)),
        ),
      };
    });

  const unresolvedPaymentsTotal = unresolvedPayments.reduce(
    (sum, row) => sum + row.amountPkr,
    0,
  );

  return {
    totals: {
      grossRevenue: totals.grossRevenue,
      grossRevenueThisMonth: monthTotals.grossRevenueThisMonth,
      doctorEarnings: totals.doctorEarnings,
      doctorEarningsThisMonth: monthTotals.doctorEarningsThisMonth,
      platformCommission: totals.platformCommission,
      platformCommissionThisMonth:
        monthTotals.grossRevenueThisMonth - monthTotals.doctorEarningsThisMonth,
      consultCount: totals.consultCount,
    },
    byDoctor,
    unresolvedPayments,
    unresolvedPaymentsTotal,
  };
}
