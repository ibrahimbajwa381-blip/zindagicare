import {
  connectDatabase,
  AppointmentModel,
  DoctorPayoutModel,
  NutritionistProfileModel,
  PaymentModel,
  ReviewModel,
  UserModel,
  VideoSessionModel,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  PaymentStatuses,
  Roles,
  calculateStaffNetEarnings,
  getVideoJoinWindow,
} from "@zindagi/shared";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { formatPhoneForDisplay, safeDisplayText } from "@/server/lib/decrypt-pii";
import {
  getNutritionistCommissionRatesByProfileId,
  getNutritionistReferredPatientIdSet,
  resolveEffectiveCommissionPercent,
} from "./commission.service";

/** Nutritionist consults are video-only, so every appointment is filtered on this. */
export const NUTRITIONIST_PROVIDER_ROLE = "nutritionist";

export type NutritionistDashboardSummary = {
  patients: number;
  pendingRequests: number;
  totalEarnings: number;
  earningsThisMonth: number;
  availableBalance: number;
  ratingAvg: number;
  ratingCount: number;
  completedThisMonth: number;
  completedAllTime: number;
  todayAppointments: number;
  upcomingThisWeek: number;
  /** Completed / (completed + missed + cancelled), 0–100. */
  completionRate: number;
  /** Patients with 2+ completed consults. */
  returningPatients: number;
};

export function emptyNutritionistDashboardSummary(): NutritionistDashboardSummary {
  return {
    patients: 0,
    pendingRequests: 0,
    totalEarnings: 0,
    earningsThisMonth: 0,
    availableBalance: 0,
    ratingAvg: 0,
    ratingCount: 0,
    completedThisMonth: 0,
    completedAllTime: 0,
    todayAppointments: 0,
    upcomingThisWeek: 0,
    completionRate: 0,
    returningPatients: 0,
  };
}

export type NutritionistEarningRow = {
  id: string;
  type: string;
  completedAt: string;
  /** Net amount credited to the nutritionist after commission. */
  amount: number;
  grossAmount: number;
  commissionAmount: number;
  commissionPercent: number;
  currency: string;
  patient: { id: string; name: string };
  /** True when the referral bonus was applied. */
  isReferralBonus: boolean;
};

export type NutritionistWithdrawalRow = {
  id: string;
  amount: number;
  currency: string;
  status: "completed";
  requestedAt: string;
  completedAt?: string;
  receiptUrl?: string;
};

export type NutritionistEarningsDetail = {
  totalGrossRevenue: number;
  grossRevenueThisMonth: number;
  totalEarnings: number;
  earningsThisMonth: number;
  totalPlatformCommission: number;
  platformCommissionThisMonth: number;
  completedPaidConsults: number;
  completedConsults: number;
  completedConsultsThisMonth: number;
  onlineCommissionPercent: number;
  availableBalance: number;
  totalWithdrawn: number;
  withdrawals: NutritionistWithdrawalRow[];
  transactions: NutritionistEarningRow[];
};

export type NutritionistOutcome =
  | "completed"
  | "missed"
  | "cancelled"
  | "upcoming"
  | "in_progress"
  | "pending";

export type NutritionistPatientRow = {
  id: string;
  name: string;
  phone?: string;
  lastVisitAt?: string;
  lastVisitEndAt?: string;
  lastVisitStatus?: string;
  lastOutcome: NutritionistOutcome;
  appointmentCount: number;
  completedCount: number;
  missedCount: number;
  cancelledCount: number;
  upcomingCount: number;
  review?: { rating: number; comment?: string; createdAt: string };
};

export type NutritionistRequestRow = {
  id: string;
  type: string;
  status: string;
  outcome: NutritionistOutcome;
  scheduledStart: string;
  scheduledEnd: string;
  consultationFee?: number;
  patient: { id: string; name: string; phone?: string };
  patientNotes?: string;
  canJoin: boolean;
  review?: { rating: number; comment?: string; createdAt: string };
};

type AppointmentLike = {
  _id: { toString(): string };
  type: string;
  status: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  completedAt?: Date | null;
  patientNotes?: string | null;
  patientId?: unknown;
  paymentId?: unknown;
};

/** Effective outcome — an overdue confirmed consult is treated as missed. */
function resolveOutcome(
  status: string,
  scheduledEnd: Date,
  now: Date,
): NutritionistOutcome {
  if (status === AppointmentStatuses.COMPLETED) return "completed";
  if (status === AppointmentStatuses.CANCELLED) return "cancelled";
  if (status === AppointmentStatuses.NO_SHOW) return "missed";
  if (status === AppointmentStatuses.IN_PROGRESS) return "in_progress";
  if (scheduledEnd < now) return "missed";
  if (status === AppointmentStatuses.CONFIRMED) return "upcoming";
  return "pending";
}

export async function getNutritionistProfileForUser(userId: string) {
  await connectDatabase();
  const user = await UserModel.findById(userId).lean();
  if (!user?.roles.includes(Roles.NUTRITIONIST)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  const profile = await NutritionistProfileModel.findOne(mongoFilter({ userId }))
    .select(
      "_id consultationFee ratingAvg ratingCount onlineCommissionPercent bankAccount",
    )
    .lean();
  if (!profile) {
    throw new AppError("Nutritionist profile not found", "NOT_FOUND", 404);
  }
  return profile;
}

function providerFilter(profileId: string) {
  return {
    providerRole: NUTRITIONIST_PROVIDER_ROLE,
    providerProfileId: profileId,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  };
}

export async function getNutritionistDashboardSummary(
  userId: string,
): Promise<NutritionistDashboardSummary> {
  const profile = await getNutritionistProfileForUser(userId);
  const profileId = profile._id.toString();

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const base = providerFilter(profileId);

  const [appointments, earnings, totalPaidOut] = await Promise.all([
    AppointmentModel.find(mongoFilter(base))
      .select("patientId status scheduledStart scheduledEnd completedAt")
      .lean(),
    getNutritionistEarningsInternal(profileId),
    sumNutritionistPayouts(profileId),
  ]);

  const patientCounts = new Map<string, number>();
  let completedAllTime = 0;
  let completedThisMonth = 0;
  let missedOrCancelled = 0;
  let todayAppointments = 0;
  let upcomingThisWeek = 0;
  let pendingRequests = 0;

  for (const appointment of appointments) {
    const patientId = appointment.patientId?.toString();
    const outcome = resolveOutcome(
      appointment.status,
      appointment.scheduledEnd,
      now,
    );

    if (outcome === "completed") {
      completedAllTime += 1;
      if (patientId) {
        patientCounts.set(patientId, (patientCounts.get(patientId) ?? 0) + 1);
      }
      const completedAt = appointment.completedAt ?? appointment.scheduledEnd;
      if (completedAt >= startOfMonth) completedThisMonth += 1;
    } else if (outcome === "missed" || outcome === "cancelled") {
      missedOrCancelled += 1;
    } else if (outcome === "pending") {
      pendingRequests += 1;
    }

    if (
      appointment.scheduledStart >= startOfToday &&
      appointment.scheduledStart < endOfToday &&
      outcome !== "cancelled"
    ) {
      todayAppointments += 1;
    }
    if (
      appointment.scheduledStart >= now &&
      appointment.scheduledStart < endOfWeek &&
      (outcome === "upcoming" || outcome === "pending")
    ) {
      upcomingThisWeek += 1;
    }
  }

  const uniquePatients = new Set(
    appointments
      .map((a) => a.patientId?.toString())
      .filter((id): id is string => Boolean(id)),
  );
  const returningPatients = [...patientCounts.values()].filter((c) => c >= 2)
    .length;
  const decided = completedAllTime + missedOrCancelled;

  return {
    patients: uniquePatients.size,
    pendingRequests,
    totalEarnings: earnings.totalEarnings,
    earningsThisMonth: earnings.earningsThisMonth,
    availableBalance: Math.max(0, earnings.totalEarnings - totalPaidOut),
    ratingAvg: profile.ratingAvg ?? 0,
    ratingCount: profile.ratingCount ?? 0,
    completedThisMonth,
    completedAllTime,
    todayAppointments,
    upcomingThisWeek,
    completionRate: decided ? Math.round((completedAllTime / decided) * 100) : 0,
    returningPatients,
  };
}

async function sumNutritionistPayouts(profileId: string): Promise<number> {
  const payouts = await DoctorPayoutModel.find(
    mongoFilter({
      providerRole: NUTRITIONIST_PROVIDER_ROLE,
      providerProfileId: profileId,
    }),
  )
    .select("amount")
    .lean();
  return payouts.reduce((sum, p) => sum + (p.amount ?? 0), 0);
}

type EarningsInternal = {
  totalEarnings: number;
  earningsThisMonth: number;
  totalGrossRevenue: number;
  grossRevenueThisMonth: number;
  completedPaidConsults: number;
  completedConsults: number;
  completedConsultsThisMonth: number;
  onlineCommissionPercent: number;
  transactions: NutritionistEarningRow[];
};

async function getNutritionistEarningsInternal(
  profileId: string,
): Promise<EarningsInternal> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const rates = await getNutritionistCommissionRatesByProfileId(profileId);

  const appointments = await AppointmentModel.find(
    mongoFilter({
      ...providerFilter(profileId),
      status: AppointmentStatuses.COMPLETED,
    }),
  )
    .select("patientId type completedAt scheduledEnd paymentId")
    .sort({ completedAt: -1, scheduledEnd: -1 })
    .lean();

  const paymentIds = appointments
    .map((a) => a.paymentId?.toString())
    .filter((id): id is string => Boolean(id));
  const payments = paymentIds.length
    ? await PaymentModel.find(
        mongoFilter({
          _id: { $in: mongoObjectIds(paymentIds) },
          status: PaymentStatuses.PAID,
        }),
      )
        .select("_id amount currency")
        .lean()
    : [];
  const paymentById = new Map(payments.map((p) => [p._id.toString(), p]));

  const patientIds = [
    ...new Set(
      appointments
        .map((a) => a.patientId?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const [referredPatientIds, patientUsers] = await Promise.all([
    getNutritionistReferredPatientIdSet(profileId, patientIds),
    patientIds.length
      ? UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(patientIds) } }))
          .select("name")
          .lean()
      : [],
  ]);
  const patientNameById = new Map(
    patientUsers.map((u) => [
      u._id.toString(),
      safeDisplayText(u.name) ?? "Patient",
    ]),
  );

  let totalEarnings = 0;
  let earningsThisMonth = 0;
  let totalGrossRevenue = 0;
  let grossRevenueThisMonth = 0;
  let completedPaidConsults = 0;
  let completedConsultsThisMonth = 0;

  const transactions: NutritionistEarningRow[] = [];

  for (const appointment of appointments) {
    const completedAt = appointment.completedAt ?? appointment.scheduledEnd;
    const inThisMonth = completedAt >= startOfMonth;
    if (inThisMonth) completedConsultsThisMonth += 1;

    const payment = paymentById.get(appointment.paymentId?.toString() ?? "");
    const gross = payment?.amount ?? 0;
    if (!payment || !gross) continue;

    const patientId = appointment.patientId?.toString() ?? "";
    const isReferred = referredPatientIds.has(patientId);
    const commissionPercent = resolveEffectiveCommissionPercent(
      rates.online,
      isReferred,
    );
    const net = calculateStaffNetEarnings(gross, commissionPercent);

    completedPaidConsults += 1;
    totalEarnings += net;
    totalGrossRevenue += gross;
    if (inThisMonth) {
      earningsThisMonth += net;
      grossRevenueThisMonth += gross;
    }

    transactions.push({
      id: appointment._id.toString(),
      type: appointment.type,
      completedAt: completedAt.toISOString(),
      amount: net,
      grossAmount: gross,
      commissionAmount: gross - net,
      commissionPercent,
      currency: payment.currency ?? "PKR",
      patient: {
        id: patientId,
        name: patientNameById.get(patientId) ?? "Patient",
      },
      isReferralBonus: isReferred,
    });
  }

  return {
    totalEarnings,
    earningsThisMonth,
    totalGrossRevenue,
    grossRevenueThisMonth,
    completedPaidConsults,
    completedConsults: appointments.length,
    completedConsultsThisMonth,
    onlineCommissionPercent: rates.online,
    transactions,
  };
}

export async function getNutritionistEarnings(
  userId: string,
): Promise<NutritionistEarningsDetail> {
  const profile = await getNutritionistProfileForUser(userId);
  const profileId = profile._id.toString();

  const [earnings, payouts] = await Promise.all([
    getNutritionistEarningsInternal(profileId),
    DoctorPayoutModel.find(
      mongoFilter({
        providerRole: NUTRITIONIST_PROVIDER_ROLE,
        providerProfileId: profileId,
      }),
    )
      .sort({ paidAt: -1 })
      .lean(),
  ]);

  const totalWithdrawn = payouts.reduce((sum, p) => sum + (p.amount ?? 0), 0);

  return {
    totalGrossRevenue: earnings.totalGrossRevenue,
    grossRevenueThisMonth: earnings.grossRevenueThisMonth,
    totalEarnings: earnings.totalEarnings,
    earningsThisMonth: earnings.earningsThisMonth,
    totalPlatformCommission:
      earnings.totalGrossRevenue - earnings.totalEarnings,
    platformCommissionThisMonth:
      earnings.grossRevenueThisMonth - earnings.earningsThisMonth,
    completedPaidConsults: earnings.completedPaidConsults,
    completedConsults: earnings.completedConsults,
    completedConsultsThisMonth: earnings.completedConsultsThisMonth,
    onlineCommissionPercent: earnings.onlineCommissionPercent,
    availableBalance: Math.max(0, earnings.totalEarnings - totalWithdrawn),
    totalWithdrawn,
    withdrawals: payouts.map((payout) => ({
      id: payout._id.toString(),
      amount: payout.amount ?? 0,
      currency: "PKR",
      status: "completed" as const,
      requestedAt: (payout.paidAt ?? payout.createdAt ?? new Date()).toISOString(),
      completedAt: payout.paidAt?.toISOString(),
      receiptUrl: payout.receipt?.url ?? undefined,
    })),
    transactions: earnings.transactions,
  };
}

export async function listNutritionistPatients(
  userId: string,
): Promise<NutritionistPatientRow[]> {
  const profile = await getNutritionistProfileForUser(userId);
  const profileId = profile._id.toString();
  const now = new Date();

  const appointments = await AppointmentModel.find(
    mongoFilter(providerFilter(profileId)),
  )
    .select("patientId status scheduledStart scheduledEnd")
    .sort({ scheduledStart: -1 })
    .lean();

  const patientIds = [
    ...new Set(
      appointments
        .map((a) => a.patientId?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (!patientIds.length) return [];

  const [users, reviews] = await Promise.all([
    UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(patientIds) } }))
      .select("name phone")
      .lean(),
    ReviewModel.find(
      mongoFilter({
        providerRole: NUTRITIONIST_PROVIDER_ROLE,
        providerProfileId: profileId,
      }),
    )
      .select("patientId rating comment createdAt")
      .sort({ createdAt: -1 })
      .lean()
      .catch(() => []),
  ]);

  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const reviewByPatient = new Map<
    string,
    { rating: number; comment?: string; createdAt: string }
  >();
  for (const review of reviews as Array<{
    patientId?: { toString(): string };
    rating?: number;
    comment?: string;
    createdAt?: Date;
  }>) {
    const key = review.patientId?.toString();
    if (!key || reviewByPatient.has(key)) continue;
    reviewByPatient.set(key, {
      rating: review.rating ?? 0,
      comment: safeDisplayText(review.comment),
      createdAt: (review.createdAt ?? new Date()).toISOString(),
    });
  }

  const rows = new Map<string, NutritionistPatientRow>();

  for (const appointment of appointments) {
    const patientId = appointment.patientId?.toString();
    if (!patientId) continue;

    const outcome = resolveOutcome(
      appointment.status,
      appointment.scheduledEnd,
      now,
    );

    let row = rows.get(patientId);
    if (!row) {
      const user = userById.get(patientId);
      row = {
        id: patientId,
        name: safeDisplayText(user?.name) ?? "Patient",
        phone: formatPhoneForDisplay(user?.phone),
        // Appointments are sorted newest-first, so the first one seen is the latest.
        lastVisitAt: appointment.scheduledStart.toISOString(),
        lastVisitEndAt: appointment.scheduledEnd.toISOString(),
        lastVisitStatus: appointment.status,
        lastOutcome: outcome,
        appointmentCount: 0,
        completedCount: 0,
        missedCount: 0,
        cancelledCount: 0,
        upcomingCount: 0,
        review: reviewByPatient.get(patientId),
      };
      rows.set(patientId, row);
    }

    row.appointmentCount += 1;
    if (outcome === "completed") row.completedCount += 1;
    else if (outcome === "missed") row.missedCount += 1;
    else if (outcome === "cancelled") row.cancelledCount += 1;
    else row.upcomingCount += 1;
  }

  return [...rows.values()].sort((a, b) =>
    (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? ""),
  );
}

export async function listNutritionistConsultRequests(
  userId: string,
): Promise<NutritionistRequestRow[]> {
  const profile = await getNutritionistProfileForUser(userId);
  const profileId = profile._id.toString();
  const now = new Date();

  const appointments = (await AppointmentModel.find(
    mongoFilter(providerFilter(profileId)),
  )
    .populate("patientId", "name phone")
    .sort({ scheduledStart: -1 })
    .limit(200)
    .lean()) as unknown as AppointmentLike[];

  const appointmentIds = appointments.map((a) => a._id.toString());
  const videoSessions = appointmentIds.length
    ? await VideoSessionModel.find(
        mongoFilter({ appointmentId: { $in: mongoObjectIds(appointmentIds) } }),
      )
        .select("appointmentId status")
        .lean()
    : [];
  const videoByAppointment = new Set(
    videoSessions.map((v) => v.appointmentId?.toString() ?? ""),
  );

  return appointments.map((appointment) => {
    const patient = appointment.patientId as {
      _id?: { toString(): string };
      name?: string;
      phone?: string;
    } | null;
    const outcome = resolveOutcome(
      appointment.status,
      appointment.scheduledEnd,
      now,
    );

    return {
      id: appointment._id.toString(),
      type: appointment.type,
      status: appointment.status,
      outcome,
      scheduledStart: appointment.scheduledStart.toISOString(),
      scheduledEnd: appointment.scheduledEnd.toISOString(),
      consultationFee: profile.consultationFee ?? undefined,
      patient: {
        id: patient?._id?.toString() ?? "",
        name: safeDisplayText(patient?.name) ?? "Patient",
        phone: formatPhoneForDisplay(patient?.phone),
      },
      patientNotes: safeDisplayText(appointment.patientNotes),
      canJoin:
        (outcome === "upcoming" || outcome === "in_progress") &&
        videoByAppointment.has(appointment._id.toString()) &&
        getVideoJoinWindow(
          appointment.scheduledStart,
          appointment.scheduledEnd,
          now,
        ).canJoin,
    };
  });
}
