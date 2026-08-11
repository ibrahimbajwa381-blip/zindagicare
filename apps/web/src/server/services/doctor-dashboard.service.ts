import {
  AppointmentModel,
  connectDatabase,
  DoctorProfileModel,
  HomeVisitModel,
  PaymentModel,
  PrescriptionModel,
  ReviewModel,
  UrgentCareRequestModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  AppointmentTypes,
  getVideoJoinWindow,
  HomeVisitServiceTypes,
  HomeVisitStatuses,
  PaymentStatuses,
  Roles,
  SUNDAY_CONSULT_CONFIG,
  UrgentCareRequestStatuses,
  VIDEO_CONSULT_CONFIG,
} from "@zindagi/shared";
import {
  formatSundayDateKey,
  getActiveOrNextSundayDate,
} from "@/lib/sunday/date-utils";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { formatPhoneForDisplay, safeDisplayText } from "@/server/lib/decrypt-pii";
import {
  calculateStaffNetEarnings,
  getDoctorCommissionRatesByProfileId,
} from "./commission.service";
import { VideoSessionService } from "./video-session.service";

const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatuses.PENDING,
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
];

const ACTIVE_HOME_VISIT_STATUSES = [
  HomeVisitStatuses.REQUESTED,
  HomeVisitStatuses.ASSIGNED,
  HomeVisitStatuses.EN_ROUTE,
  HomeVisitStatuses.ARRIVED,
];

/** Appointments still within the join / visit window (not only future starts). */
function activeConsultRequestFilter(now = new Date()) {
  const windowEnd = new Date(
    now.getTime() - VIDEO_CONSULT_CONFIG.joinLateMinutes * 60_000,
  );

  return {
    type: {
      $in: [
        AppointmentTypes.ONLINE,
        AppointmentTypes.CLINIC,
        AppointmentTypes.URGENT_ONLINE,
        AppointmentTypes.SUNDAY_FREE,
      ],
    },
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    scheduledEnd: { $gte: windowEnd },
  };
}

export type DoctorDashboardSummary = {
  patients: number;
  pendingRequests: number;
  sundayQueue: number;
  homeVisitRequests: number;
  urgentCalls: number;
  totalEarnings: number;
  earningsThisMonth: number;
  availableBalance: number;
  /** Patient-facing rating shown on the public profile. */
  ratingAvg: number;
  ratingCount: number;
  /** Completed paid/unpaid consults finished this calendar month. */
  completedThisMonth: number;
  completedAllTime: number;
  /** Active or scheduled appointments for today. */
  todayAppointments: number;
  /** Upcoming appointments in the next 7 days (confirmed/pending/in progress). */
  upcomingThisWeek: number;
  /** Completed / (completed + missed + cancelled), 0–100. */
  completionRate: number;
  prescriptionsWritten: number;
  /** Patients with 2+ completed consults. */
  returningPatients: number;
};

export function emptyDoctorDashboardSummary(): DoctorDashboardSummary {
  return {
    patients: 0,
    pendingRequests: 0,
    sundayQueue: 0,
    homeVisitRequests: 0,
    urgentCalls: 0,
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
    prescriptionsWritten: 0,
    returningPatients: 0,
  };
}

export type DoctorEarningRow = {
  id: string;
  type: string;
  completedAt: string;
  /** Net amount credited to the doctor after commission. */
  amount: number;
  grossAmount: number;
  commissionAmount: number;
  commissionPercent: number;
  currency: string;
  patient: { id: string; name: string };
};

export type DoctorConsultCounts = {
  online: number;
  clinic: number;
  urgent: number;
  homeVisit: number;
  total: number;
};

export type DoctorWithdrawalRow = {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed";
  requestedAt: string;
  completedAt?: string;
};

export type DoctorEarningsDetail = {
  /** Gross patient payments before platform commission. */
  totalGrossRevenue: number;
  grossRevenueThisMonth: number;
  /** Net amount credited to the doctor after commission. */
  totalEarnings: number;
  earningsThisMonth: number;
  totalPlatformCommission: number;
  platformCommissionThisMonth: number;
  completedPaidConsults: number;
  completedConsults: DoctorConsultCounts;
  completedConsultsThisMonth: DoctorConsultCounts;
  onlineCommissionPercent: number;
  homeVisitCommissionPercent: number;
  availableBalance: number;
  totalWithdrawn: number;
  pendingWithdrawal: number;
  withdrawals: DoctorWithdrawalRow[];
  transactions: DoctorEarningRow[];
};

export type DoctorPatientLastOutcome =
  | "completed"
  | "missed"
  | "cancelled"
  | "upcoming"
  | "in_progress"
  | "pending";

export type DoctorPatientReviewSummary = {
  rating: number;
  comment?: string;
  createdAt: string;
};

export type DoctorPatientRow = {
  id: string;
  name: string;
  phone?: string;
  lastVisitAt?: string;
  lastVisitEndAt?: string;
  lastVisitType?: string;
  lastVisitStatus?: string;
  /** Effective outcome for the latest consult (treats overdue confirmed as missed). */
  lastOutcome: DoctorPatientLastOutcome;
  appointmentCount: number;
  completedCount: number;
  missedCount: number;
  cancelledCount: number;
  upcomingCount: number;
  prescriptionCount: number;
  review?: DoctorPatientReviewSummary;
};

export type DoctorRequestOutcome =
  | "completed"
  | "missed"
  | "cancelled"
  | "upcoming"
  | "in_progress"
  | "pending";

export type DoctorRequestRow = {
  id: string;
  type: string;
  status: string;
  /** Effective outcome used for category filters (overdue confirmed → missed). */
  outcome: DoctorRequestOutcome;
  scheduledStart: string;
  scheduledEnd: string;
  consultationFee?: number;
  patient: { id: string; name: string; phone?: string };
  patientNotes?: string;
  canJoin: boolean;
  hasPrescription: boolean;
  review?: {
    rating: number;
    comment?: string;
    createdAt: string;
  };
};

export type DoctorHomeVisitRow = {
  id: string;
  status: string;
  scheduledAt: string;
  address: { line: string; city: string };
  patient?: { id: string; name: string; phone?: string };
  patientNotes?: string;
  pricing: { total: number; currency: string };
};

async function getDoctorProfileForUser(userId: string) {
  await connectDatabase();
  const user = await UserModel.findById(userId).lean();
  if (!user?.roles.includes(Roles.DOCTOR)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  const profile = await DoctorProfileModel.findOne(mongoFilter({ userId: user._id }));
  if (!profile) {
    throw new AppError("Doctor profile not found", "NOT_FOUND", 404);
  }
  return { user, profile };
}

async function loadDoctorEarningsTotals(profileId: string, userId: string) {
  const detail = await buildDoctorEarningsDetail(profileId, userId);
  return {
    totalEarnings: detail.totalEarnings,
    earningsThisMonth: detail.earningsThisMonth,
    availableBalance: detail.availableBalance,
  };
}

async function resolveGrossAmounts(
  paymentIds: string[],
  fallbackByPaymentId: Map<string, number>,
): Promise<Map<string, { amount: number; currency: string }>> {
  const result = new Map<string, { amount: number; currency: string }>();
  if (!paymentIds.length) return result;

  const payments = await PaymentModel.find(
    mongoFilter({ _id: { $in: mongoObjectIds(paymentIds) }, status: PaymentStatuses.PAID }),
  )
    .select("_id amount currency")
    .lean();

  for (const payment of payments) {
    const id = payment._id.toString();
    result.set(id, {
      amount: payment.amount ?? fallbackByPaymentId.get(id) ?? 0,
      currency: payment.currency ?? "PKR",
    });
  }

  for (const [id, amount] of fallbackByPaymentId) {
    if (!result.has(id) && amount > 0) {
      result.set(id, { amount, currency: "PKR" });
    }
  }

  return result;
}

function emptyConsultCounts(): DoctorConsultCounts {
  return { online: 0, clinic: 0, urgent: 0, homeVisit: 0, total: 0 };
}

function incrementConsultCount(counts: DoctorConsultCounts, type: string) {
  switch (type) {
    case AppointmentTypes.ONLINE:
      counts.online += 1;
      break;
    case AppointmentTypes.CLINIC:
      counts.clinic += 1;
      break;
    case AppointmentTypes.URGENT_ONLINE:
      counts.urgent += 1;
      break;
    case HomeVisitServiceTypes.DOCTOR_VISIT:
    case AppointmentTypes.HOME_VISIT:
      counts.homeVisit += 1;
      break;
    default:
      break;
  }
  counts.total += 1;
}

async function buildDoctorEarningsDetail(
  profileId: string,
  userId: string,
): Promise<DoctorEarningsDetail> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const commissionRates = await getDoctorCommissionRatesByProfileId(profileId);

  const [completedAppts, completedHomeVisits] = await Promise.all([
    AppointmentModel.find(
      mongoFilter({
        doctorId: profileId,
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
        status: AppointmentStatuses.COMPLETED,
        paymentId: { $exists: true, $ne: null },
      }),
    )
      .populate("patientId", "name")
      .sort({ completedAt: -1 })
      .limit(100)
      .lean(),
    HomeVisitModel.find(
      mongoFilter({
        serviceType: HomeVisitServiceTypes.DOCTOR_VISIT,
        assignedStaffId: userId,
        status: HomeVisitStatuses.COMPLETED,
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      }),
    )
      .populate("patientId", "name")
      .sort({ completedAt: -1 })
      .limit(100)
      .lean(),
  ]);

  const paymentFallbacks = new Map<string, number>();
  for (const visit of completedHomeVisits) {
    const paymentId = visit.paymentId?.toString();
    if (paymentId && visit.pricing?.total) {
      paymentFallbacks.set(paymentId, visit.pricing.total);
    }
  }

  const paymentIds = [
    ...new Set([
      ...completedAppts
        .map((a) => a.paymentId?.toString())
        .filter((id): id is string => Boolean(id)),
      ...completedHomeVisits
        .map((v) => v.paymentId?.toString())
        .filter((id): id is string => Boolean(id)),
    ]),
  ];

  const paymentMap = await resolveGrossAmounts(paymentIds, paymentFallbacks);

  let totalGrossRevenue = 0;
  let grossRevenueThisMonth = 0;
  let totalEarnings = 0;
  let earningsThisMonth = 0;
  let totalPlatformCommission = 0;
  let platformCommissionThisMonth = 0;
  const completedConsults = emptyConsultCounts();
  const completedConsultsThisMonth = emptyConsultCounts();
  const transactions: DoctorEarningRow[] = [];

  for (const appt of completedAppts) {
    const paymentId = appt.paymentId?.toString();
    if (!paymentId) continue;
    const payment = paymentMap.get(paymentId);
    const grossAmount = payment?.amount ?? 0;
    if (!grossAmount) continue;

    const netAmount = calculateStaffNetEarnings(
      grossAmount,
      commissionRates.online,
    );
    const commissionAmount = grossAmount - netAmount;
    totalGrossRevenue += grossAmount;
    totalEarnings += netAmount;
    totalPlatformCommission += commissionAmount;
    const completedAt = appt.completedAt ?? appt.scheduledStart;
    const isThisMonth = completedAt >= startOfMonth;
    if (isThisMonth) {
      grossRevenueThisMonth += grossAmount;
      earningsThisMonth += netAmount;
      platformCommissionThisMonth += commissionAmount;
      incrementConsultCount(completedConsultsThisMonth, appt.type);
    }
    incrementConsultCount(completedConsults, appt.type);

    const patient = appt.patientId as
      | { _id?: { toString(): string }; name?: string }
      | null;

    transactions.push({
      id: appt._id.toString(),
      type: appt.type,
      completedAt: completedAt.toISOString(),
      amount: netAmount,
      grossAmount,
      commissionAmount,
      commissionPercent: commissionRates.online,
      currency: payment?.currency ?? "PKR",
      patient: {
        id: patient?._id?.toString() ?? "",
        name: safeDisplayText(patient?.name) ?? "Patient",
      },
    });
  }

  for (const visit of completedHomeVisits) {
    const paymentId = visit.paymentId?.toString();
    const payment = paymentId ? paymentMap.get(paymentId) : undefined;
    const grossAmount = payment?.amount ?? visit.pricing?.total ?? 0;
    if (!grossAmount) continue;

    const netAmount = calculateStaffNetEarnings(
      grossAmount,
      commissionRates.homeVisit,
    );
    const commissionAmount = grossAmount - netAmount;
    totalGrossRevenue += grossAmount;
    totalEarnings += netAmount;
    totalPlatformCommission += commissionAmount;
    const completedAt = visit.completedAt ?? visit.scheduledAt;
    const isThisMonth = completedAt >= startOfMonth;
    if (isThisMonth) {
      grossRevenueThisMonth += grossAmount;
      earningsThisMonth += netAmount;
      platformCommissionThisMonth += commissionAmount;
      incrementConsultCount(
        completedConsultsThisMonth,
        HomeVisitServiceTypes.DOCTOR_VISIT,
      );
    }
    incrementConsultCount(completedConsults, HomeVisitServiceTypes.DOCTOR_VISIT);

    const patient = visit.patientId as
      | { _id?: { toString(): string }; name?: string }
      | null;

    transactions.push({
      id: visit._id.toString(),
      type: HomeVisitServiceTypes.DOCTOR_VISIT,
      completedAt: completedAt.toISOString(),
      amount: netAmount,
      grossAmount,
      commissionAmount,
      commissionPercent: commissionRates.homeVisit,
      currency: payment?.currency ?? visit.pricing?.currency ?? "PKR",
      patient: {
        id: patient?._id?.toString() ?? "",
        name: safeDisplayText(patient?.name) ?? "Patient",
      },
    });
  }

  transactions.sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  const totalWithdrawn = 0;
  const pendingWithdrawal = 0;
  const withdrawals: DoctorWithdrawalRow[] = [];

  return {
    totalGrossRevenue,
    grossRevenueThisMonth,
    totalEarnings,
    earningsThisMonth,
    totalPlatformCommission,
    platformCommissionThisMonth,
    completedPaidConsults: transactions.length,
    completedConsults,
    completedConsultsThisMonth,
    onlineCommissionPercent: commissionRates.online,
    homeVisitCommissionPercent: commissionRates.homeVisit,
    availableBalance: Math.max(0, totalEarnings - totalWithdrawn - pendingWithdrawal),
    totalWithdrawn,
    pendingWithdrawal,
    withdrawals,
    transactions: transactions.slice(0, 100),
  };
}

export async function getDoctorDashboardSummary(
  userId: string,
): Promise<DoctorDashboardSummary> {
  const { profile } = await getDoctorProfileForUser(userId);
  const now = new Date();
  const sundayDate = getActiveOrNextSundayDate(now);
  const sundayDateKey = formatSundayDateKey(sundayDate);
  const sundayEnd = new Date(sundayDate.getTime() + 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
  const doctorFilter = mongoFilter({
    doctorId: profile._id,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  });

  const [
    patientIds,
    pendingRequests,
    sundayQueue,
    homeVisitRequests,
    urgentCalls,
    earnings,
    completedApptsThisMonth,
    completedApptsAllTime,
    completedHomeVisitsThisMonth,
    completedHomeVisitsAllTime,
    todayAppointments,
    upcomingThisWeek,
    outcomeCounts,
    prescriptionsWritten,
    returningPatientsAgg,
  ] = await Promise.all([
    AppointmentModel.distinct("patientId", mongoFilter({ doctorId: profile._id })),
    AppointmentModel.countDocuments(
      mongoFilter({
        doctorId: profile._id,
        ...activeConsultRequestFilter(now),
      }),
    ),
    AppointmentModel.countDocuments(
      mongoFilter({
        doctorId: profile._id,
        type: AppointmentTypes.SUNDAY_FREE,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        $or: [
          { sundayDateKey },
          { scheduledStart: { $gte: sundayDate, $lt: sundayEnd } },
        ],
      }),
    ),
    HomeVisitModel.countDocuments(
      mongoFilter({
        serviceType: HomeVisitServiceTypes.DOCTOR_VISIT,
        assignedStaffId: userId,
        status: { $in: ACTIVE_HOME_VISIT_STATUSES },
      }),
    ),
    UrgentCareRequestModel.countDocuments(
      mongoFilter({
        assignedDoctorId: profile._id,
        status: UrgentCareRequestStatuses.ASSIGNED,
      }),
    ),
    loadDoctorEarningsTotals(profile._id.toString(), userId),
    AppointmentModel.countDocuments(
      mongoFilter({
        doctorId: profile._id,
        status: AppointmentStatuses.COMPLETED,
        deletedAt: null,
        $or: [
          { completedAt: { $gte: startOfMonth } },
          {
            completedAt: null,
            scheduledStart: { $gte: startOfMonth },
          },
        ],
      }),
    ),
    AppointmentModel.countDocuments(
      mongoFilter({
        doctorId: profile._id,
        status: AppointmentStatuses.COMPLETED,
        deletedAt: null,
      }),
    ),
    HomeVisitModel.countDocuments(
      mongoFilter({
        serviceType: HomeVisitServiceTypes.DOCTOR_VISIT,
        assignedStaffId: userId,
        status: HomeVisitStatuses.COMPLETED,
        deletedAt: null,
        $or: [
          { completedAt: { $gte: startOfMonth } },
          {
            completedAt: null,
            scheduledAt: { $gte: startOfMonth },
          },
        ],
      }),
    ),
    HomeVisitModel.countDocuments(
      mongoFilter({
        serviceType: HomeVisitServiceTypes.DOCTOR_VISIT,
        assignedStaffId: userId,
        status: HomeVisitStatuses.COMPLETED,
        deletedAt: null,
      }),
    ),
    AppointmentModel.countDocuments(
      mongoFilter({
        doctorId: profile._id,
        deletedAt: null,
        scheduledStart: { $gte: startOfToday, $lt: endOfToday },
        status: {
          $in: [...ACTIVE_APPOINTMENT_STATUSES, AppointmentStatuses.COMPLETED],
        },
      }),
    ),
    AppointmentModel.countDocuments(
      mongoFilter({
        doctorId: profile._id,
        deletedAt: null,
        scheduledStart: { $gte: now, $lt: endOfWeek },
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      }),
    ),
    AppointmentModel.aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: doctorFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    PrescriptionModel.countDocuments(
      mongoFilter({
        doctorId: profile._id,
        deletedAt: null,
      }),
    ),
    AppointmentModel.aggregate<{ count: number }>([
      {
        $match: mongoFilter({
          doctorId: profile._id,
          deletedAt: null,
          status: AppointmentStatuses.COMPLETED,
        }),
      },
      { $group: { _id: "$patientId", completed: { $sum: 1 } } },
      { $match: { completed: { $gte: 2 } } },
      { $count: "count" },
    ]),
  ]);

  const completed =
    outcomeCounts.find((row) => row._id === AppointmentStatuses.COMPLETED)?.count ?? 0;
  const missed =
    outcomeCounts.find((row) => row._id === AppointmentStatuses.NO_SHOW)?.count ?? 0;
  const cancelled =
    outcomeCounts.find((row) => row._id === AppointmentStatuses.CANCELLED)?.count ?? 0;
  const settled = completed + missed + cancelled;
  const completionRate =
    settled > 0 ? Math.round((completed / settled) * 100) : 0;

  return {
    patients: patientIds.length,
    pendingRequests,
    sundayQueue,
    homeVisitRequests,
    urgentCalls,
    totalEarnings: earnings.totalEarnings,
    earningsThisMonth: earnings.earningsThisMonth,
    availableBalance: earnings.availableBalance,
    ratingAvg: profile.ratingAvg ?? 0,
    ratingCount: profile.ratingCount ?? 0,
    completedThisMonth: completedApptsThisMonth + completedHomeVisitsThisMonth,
    completedAllTime: completedApptsAllTime + completedHomeVisitsAllTime,
    todayAppointments,
    upcomingThisWeek,
    completionRate,
    prescriptionsWritten,
    returningPatients: returningPatientsAgg[0]?.count ?? 0,
  };
}

export async function getDoctorEarnings(userId: string): Promise<DoctorEarningsDetail> {
  const { profile } = await getDoctorProfileForUser(userId);
  return buildDoctorEarningsDetail(profile._id.toString(), userId);
}

function resolveDoctorPatientLastOutcome(
  status: string | undefined,
  scheduledStart?: Date,
  scheduledEnd?: Date,
  now = new Date(),
  type?: string,
): DoctorPatientLastOutcome {
  return resolveConsultOutcome(status, scheduledStart, scheduledEnd, now, type);
}

/** Admin-matched Sunday free used a short slot end; keep the match SLA joinable. */
function effectiveVideoEnd(type: string | undefined, start: Date, end: Date) {
  if (type !== AppointmentTypes.SUNDAY_FREE) return end;
  const matchEnd = new Date(
    start.getTime() + SUNDAY_CONSULT_CONFIG.matchWithinMinutes * 60_000,
  );
  return matchEnd > end ? matchEnd : end;
}

function resolveConsultOutcome(
  status: string | undefined,
  scheduledStart?: Date,
  scheduledEnd?: Date,
  now = new Date(),
  type?: string,
): DoctorRequestOutcome {
  if (status === AppointmentStatuses.COMPLETED) return "completed";
  if (status === AppointmentStatuses.NO_SHOW) return "missed";
  if (status === AppointmentStatuses.CANCELLED) return "cancelled";
  if (status === AppointmentStatuses.IN_PROGRESS) return "in_progress";
  if (status === AppointmentStatuses.PENDING) return "pending";

  if (
    status === AppointmentStatuses.CONFIRMED &&
    scheduledStart &&
    scheduledEnd
  ) {
    const { joinClosesAt } = getVideoJoinWindow(
      scheduledStart,
      effectiveVideoEnd(type, scheduledStart, scheduledEnd),
      now,
    );
    if (now > joinClosesAt) return "missed";
    return "upcoming";
  }

  return "upcoming";
}

function canJoinConsultRequest(
  type: string,
  status: string,
  outcome: DoctorRequestOutcome,
  scheduledStart: Date,
  scheduledEnd: Date,
  now = new Date(),
) {
  if (
    type !== AppointmentTypes.ONLINE &&
    type !== AppointmentTypes.URGENT_ONLINE &&
    type !== AppointmentTypes.SUNDAY_FREE
  ) {
    return false;
  }

  if (
    status !== AppointmentStatuses.CONFIRMED &&
    status !== AppointmentStatuses.IN_PROGRESS
  ) {
    return false;
  }

  if (outcome === "missed" || outcome === "cancelled" || outcome === "completed") {
    return false;
  }

  const { canJoin } = getVideoJoinWindow(
    scheduledStart,
    effectiveVideoEnd(type, scheduledStart, scheduledEnd),
    now,
  );
  return canJoin || status === AppointmentStatuses.IN_PROGRESS;
}

export async function listDoctorPatients(userId: string): Promise<DoctorPatientRow[]> {
  const { profile } = await getDoctorProfileForUser(userId);
  const now = new Date();
  const overdueCutoff = new Date(
    now.getTime() - VIDEO_CONSULT_CONFIG.joinLateMinutes * 60_000,
  );

  const grouped = await AppointmentModel.aggregate<{
    _id: unknown;
    lastVisitAt: Date;
    lastVisitEndAt: Date;
    lastVisitStatus: string;
    lastVisitType: string;
    appointmentCount: number;
    completedCount: number;
    missedCount: number;
    cancelledCount: number;
    upcomingCount: number;
  }>([
    {
      $match: mongoFilter({
        doctorId: profile._id,
        deletedAt: null,
      }),
    },
    { $sort: { scheduledStart: -1 } },
    {
      $group: {
        _id: "$patientId",
        lastVisitAt: { $first: "$scheduledStart" },
        lastVisitEndAt: { $first: "$scheduledEnd" },
        lastVisitStatus: { $first: "$status" },
        lastVisitType: { $first: "$type" },
        appointmentCount: { $sum: 1 },
        completedCount: {
          $sum: {
            $cond: [{ $eq: ["$status", AppointmentStatuses.COMPLETED] }, 1, 0],
          },
        },
        missedCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$status", AppointmentStatuses.NO_SHOW] },
                  {
                    $and: [
                      { $eq: ["$status", AppointmentStatuses.CONFIRMED] },
                      { $lt: ["$scheduledEnd", overdueCutoff] },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        cancelledCount: {
          $sum: {
            $cond: [{ $eq: ["$status", AppointmentStatuses.CANCELLED] }, 1, 0],
          },
        },
        upcomingCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$status", AppointmentStatuses.PENDING] },
                  { $eq: ["$status", AppointmentStatuses.IN_PROGRESS] },
                  {
                    $and: [
                      { $eq: ["$status", AppointmentStatuses.CONFIRMED] },
                      { $gte: ["$scheduledEnd", overdueCutoff] },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { lastVisitAt: -1 } },
    { $limit: 100 },
  ]);

  const patientIds = grouped.map((row) => String(row._id));
  if (patientIds.length === 0) return [];

  const [patients, reviews, prescriptionCounts] = await Promise.all([
    UserModel.find(mongoFilter({ _id: { $in: patientIds } }))
      .select("name phone")
      .lean(),
    ReviewModel.find(
      mongoFilter({
        doctorId: profile._id,
        patientId: { $in: patientIds },
        deletedAt: null,
        isVisible: true,
      }),
    )
      .sort({ createdAt: -1 })
      .select("patientId rating comment createdAt")
      .lean(),
    PrescriptionModel.aggregate<{ _id: unknown; count: number }>([
      {
        $match: mongoFilter({
          doctorId: profile._id,
          patientId: { $in: patientIds },
          deletedAt: null,
        }),
      },
      { $group: { _id: "$patientId", count: { $sum: 1 } } },
    ]),
  ]);

  const patientMap = new Map(patients.map((p) => [p._id.toString(), p]));
  const reviewByPatient = new Map<string, DoctorPatientReviewSummary>();
  for (const review of reviews) {
    const patientId = review.patientId.toString();
    if (reviewByPatient.has(patientId)) continue;
    reviewByPatient.set(patientId, {
      rating: review.rating,
      comment: review.comment ?? undefined,
      createdAt: review.createdAt.toISOString(),
    });
  }
  const prescriptionByPatient = new Map(
    prescriptionCounts.map((row) => [String(row._id), row.count]),
  );

  return grouped.map((row) => {
    const id = String(row._id);
    const patient = patientMap.get(id);
    const lastOutcome = resolveDoctorPatientLastOutcome(
      row.lastVisitStatus,
      row.lastVisitAt,
      row.lastVisitEndAt,
      now,
      row.lastVisitType,
    );

    return {
      id,
      name: safeDisplayText(patient?.name) ?? "Patient",
      phone: formatPhoneForDisplay(patient?.phone),
      lastVisitAt: row.lastVisitAt?.toISOString(),
      lastVisitEndAt: row.lastVisitEndAt?.toISOString(),
      lastVisitType: row.lastVisitType,
      lastVisitStatus: row.lastVisitStatus,
      lastOutcome,
      appointmentCount: row.appointmentCount,
      completedCount: row.completedCount,
      missedCount: row.missedCount,
      cancelledCount: row.cancelledCount,
      upcomingCount: row.upcomingCount,
      prescriptionCount: prescriptionByPatient.get(id) ?? 0,
      review: reviewByPatient.get(id),
    };
  });
}

export async function listDoctorConsultRequests(
  userId: string,
): Promise<DoctorRequestRow[]> {
  const { profile } = await getDoctorProfileForUser(userId);
  const now = new Date();

  const appointments = await AppointmentModel.find(
    mongoFilter({
      doctorId: profile._id,
      type: {
        $in: [
          AppointmentTypes.ONLINE,
          AppointmentTypes.CLINIC,
          AppointmentTypes.URGENT_ONLINE,
          AppointmentTypes.SUNDAY_FREE,
        ],
      },
      deletedAt: null,
    }),
  )
    .populate("patientId", "name phone")
    .populate("paymentId", "amount status")
    .sort({ scheduledStart: -1 })
    .limit(150)
    .lean();

  if (appointments.length === 0) return [];

  const staleAfterMs = 2 * 60 * 60 * 1000;
  for (const apt of appointments) {
    if (apt.status !== AppointmentStatuses.IN_PROGRESS) continue;
    const { joinClosesAt } = getVideoJoinWindow(
      apt.scheduledStart,
      effectiveVideoEnd(apt.type, apt.scheduledStart, apt.scheduledEnd),
      now,
    );
    if (now.getTime() <= joinClosesAt.getTime() + staleAfterMs) continue;

    const finalized = await VideoSessionService.finalizeAppointmentIfAttended(
      apt._id.toString(),
    );
    if (finalized) {
      apt.status = AppointmentStatuses.COMPLETED;
    }
  }

  const appointmentIds = appointments.map((apt) => apt._id.toString());

  const [reviews, prescriptions] = await Promise.all([
    ReviewModel.find(
      mongoFilter({
        appointmentId: { $in: appointmentIds },
        deletedAt: null,
        isVisible: true,
      }),
    )
      .select("appointmentId rating comment createdAt")
      .lean(),
    PrescriptionModel.find(
      mongoFilter({
        appointmentId: { $in: appointmentIds },
        deletedAt: null,
      }),
    )
      .select("appointmentId")
      .lean(),
  ]);

  const reviewByAppointment = new Map(
    reviews.map((review) => [
      review.appointmentId.toString(),
      {
        rating: review.rating,
        comment: review.comment ?? undefined,
        createdAt: review.createdAt.toISOString(),
      },
    ]),
  );
  const prescriptionAppointmentIds = new Set(
    prescriptions
      .map((rx) => rx.appointmentId?.toString())
      .filter((id): id is string => !!id),
  );

  return appointments.map((apt) => {
    const patient = apt.patientId as
      | { _id?: { toString(): string }; name?: string; phone?: string }
      | null;
    const payment = apt.paymentId as
      | { amount?: number; status?: string }
      | null;
    const outcome = resolveConsultOutcome(
      apt.status,
      apt.scheduledStart,
      apt.scheduledEnd,
      now,
      apt.type,
    );
    const id = apt._id.toString();

    return {
      id,
      type: apt.type,
      status: apt.status,
      outcome,
      scheduledStart: apt.scheduledStart.toISOString(),
      scheduledEnd: apt.scheduledEnd.toISOString(),
      consultationFee:
        payment?.status === PaymentStatuses.PAID ? payment.amount : undefined,
      patient: {
        id: patient?._id?.toString() ?? "",
        name: safeDisplayText(patient?.name) ?? "Patient",
        phone: formatPhoneForDisplay(patient?.phone),
      },
      patientNotes: apt.patientNotes ?? undefined,
      canJoin: canJoinConsultRequest(
        apt.type,
        apt.status,
        outcome,
        apt.scheduledStart,
        apt.scheduledEnd,
        now,
      ),
      hasPrescription: prescriptionAppointmentIds.has(id),
      review: reviewByAppointment.get(id),
    };
  });
}

export async function listDoctorHomeVisitRequests(
  userId: string,
): Promise<DoctorHomeVisitRow[]> {
  await getDoctorProfileForUser(userId);

  const visits = await HomeVisitModel.find(
    mongoFilter({
      serviceType: HomeVisitServiceTypes.DOCTOR_VISIT,
      assignedStaffId: userId,
      status: { $in: ACTIVE_HOME_VISIT_STATUSES },
    }),
  )
    .populate("patientId", "name phone")
    .sort({ scheduledAt: 1 })
    .limit(50)
    .lean();

  return visits.map((visit) => {
    const patient = visit.patientId as
      | { _id?: { toString(): string }; name?: string; phone?: string }
      | null;
    return {
      id: visit._id.toString(),
      status: visit.status,
      scheduledAt: visit.scheduledAt.toISOString(),
      address: {
        line: safeDisplayText(visit.address?.line) ?? "",
        city: safeDisplayText(visit.address?.city) ?? "",
      },
      patient: patient?._id
        ? {
            id: patient._id.toString(),
            name: safeDisplayText(patient.name) ?? "Patient",
            phone: formatPhoneForDisplay(patient.phone),
          }
        : undefined,
      patientNotes: visit.patientNotes ?? undefined,
      pricing: {
        total: visit.pricing?.total ?? 0,
        currency: visit.pricing?.currency ?? "PKR",
      },
    };
  });
}
