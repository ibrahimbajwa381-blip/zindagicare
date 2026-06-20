import {
  AppointmentModel,
  connectDatabase,
  DoctorProfileModel,
  HomeVisitModel,
  PaymentModel,
  UrgentCareRequestModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  AppointmentTypes,
  HomeVisitServiceTypes,
  HomeVisitStatuses,
  PaymentStatuses,
  Roles,
  UrgentCareRequestStatuses,
  VIDEO_CONSULT_CONFIG,
} from "@zindagi/shared";
import { getNextSundayDate } from "@/lib/sunday/date-utils";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { formatPhoneForDisplay, safeDisplayText } from "@/server/lib/decrypt-pii";
import {
  calculateStaffNetEarnings,
  getDoctorCommissionRatesByProfileId,
} from "./commission.service";

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
    type: { $in: [AppointmentTypes.ONLINE, AppointmentTypes.CLINIC, AppointmentTypes.URGENT_ONLINE] },
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    $or: [
      { scheduledEnd: { $gte: windowEnd } },
      { status: AppointmentStatuses.IN_PROGRESS },
    ],
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
};

export type DoctorEarningRow = {
  id: string;
  type: string;
  completedAt: string;
  /** Net amount credited to the doctor after commission. */
  amount: number;
  grossAmount: number;
  commissionPercent: number;
  currency: string;
  patient: { id: string; name: string };
};

export type DoctorEarningsDetail = {
  totalEarnings: number;
  earningsThisMonth: number;
  completedPaidConsults: number;
  onlineCommissionPercent: number;
  homeVisitCommissionPercent: number;
  transactions: DoctorEarningRow[];
};

export type DoctorPatientRow = {
  id: string;
  name: string;
  phone?: string;
  lastVisitAt?: string;
  appointmentCount: number;
};

export type DoctorRequestRow = {
  id: string;
  type: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  patient: { id: string; name: string; phone?: string };
  patientNotes?: string;
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

  let totalEarnings = 0;
  let earningsThisMonth = 0;
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
    totalEarnings += netAmount;
    const completedAt = appt.completedAt ?? appt.scheduledStart;
    if (completedAt >= startOfMonth) {
      earningsThisMonth += netAmount;
    }

    const patient = appt.patientId as
      | { _id?: { toString(): string }; name?: string }
      | null;

    transactions.push({
      id: appt._id.toString(),
      type: appt.type,
      completedAt: completedAt.toISOString(),
      amount: netAmount,
      grossAmount,
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
    totalEarnings += netAmount;
    const completedAt = visit.completedAt ?? visit.scheduledAt;
    if (completedAt >= startOfMonth) {
      earningsThisMonth += netAmount;
    }

    const patient = visit.patientId as
      | { _id?: { toString(): string }; name?: string }
      | null;

    transactions.push({
      id: visit._id.toString(),
      type: HomeVisitServiceTypes.DOCTOR_VISIT,
      completedAt: completedAt.toISOString(),
      amount: netAmount,
      grossAmount,
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

  return {
    totalEarnings,
    earningsThisMonth,
    completedPaidConsults: transactions.length,
    onlineCommissionPercent: commissionRates.online,
    homeVisitCommissionPercent: commissionRates.homeVisit,
    transactions: transactions.slice(0, 100),
  };
}

export async function getDoctorDashboardSummary(
  userId: string,
): Promise<DoctorDashboardSummary> {
  const { profile } = await getDoctorProfileForUser(userId);
  const now = new Date();
  const sundayDate = getNextSundayDate();
  const sundayEnd = new Date(sundayDate.getTime() + 24 * 60 * 60 * 1000);

  const [patientIds, pendingRequests, sundayQueue, homeVisitRequests, urgentCalls, earnings] =
    await Promise.all([
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
          scheduledStart: { $gte: sundayDate, $lt: sundayEnd },
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
    ]);

  return {
    patients: patientIds.length,
    pendingRequests,
    sundayQueue,
    homeVisitRequests,
    urgentCalls,
    totalEarnings: earnings.totalEarnings,
    earningsThisMonth: earnings.earningsThisMonth,
  };
}

export async function getDoctorEarnings(userId: string): Promise<DoctorEarningsDetail> {
  const { profile } = await getDoctorProfileForUser(userId);
  return buildDoctorEarningsDetail(profile._id.toString(), userId);
}

export async function listDoctorPatients(userId: string): Promise<DoctorPatientRow[]> {
  const { profile } = await getDoctorProfileForUser(userId);

  const grouped = await AppointmentModel.aggregate<{
    _id: unknown;
    lastVisitAt: Date;
    appointmentCount: number;
  }>([
    { $match: { doctorId: profile._id } },
    {
      $group: {
        _id: "$patientId",
        lastVisitAt: { $max: "$scheduledStart" },
        appointmentCount: { $sum: 1 },
      },
    },
    { $sort: { lastVisitAt: -1 } },
    { $limit: 100 },
  ]);

  const patientIds = grouped.map((row) => row._id);
  const patients = await UserModel.find(
    mongoFilter({
      _id: { $in: patientIds.map((id) => String(id)) },
    }),
  )
    .select("name phone")
    .lean();
  const patientMap = new Map(
    patients.map((p) => [p._id.toString(), p]),
  );

  return grouped.map((row) => {
    const id = (row._id as { toString(): string }).toString();
    const patient = patientMap.get(id);
    return {
      id,
      name: safeDisplayText(patient?.name) ?? "Patient",
      phone: formatPhoneForDisplay(patient?.phone),
      lastVisitAt: row.lastVisitAt?.toISOString(),
      appointmentCount: row.appointmentCount,
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
      ...activeConsultRequestFilter(now),
    }),
  )
    .populate("patientId", "name phone")
    .sort({ scheduledStart: 1 })
    .limit(50)
    .lean();

  return appointments.map((apt) => {
    const patient = apt.patientId as
      | { _id?: { toString(): string }; name?: string; phone?: string }
      | null;
    return {
      id: apt._id.toString(),
      type: apt.type,
      status: apt.status,
      scheduledStart: apt.scheduledStart.toISOString(),
      scheduledEnd: apt.scheduledEnd.toISOString(),
      patient: {
        id: patient?._id?.toString() ?? "",
        name: safeDisplayText(patient?.name) ?? "Patient",
        phone: formatPhoneForDisplay(patient?.phone),
      },
      patientNotes: apt.patientNotes ?? undefined,
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
