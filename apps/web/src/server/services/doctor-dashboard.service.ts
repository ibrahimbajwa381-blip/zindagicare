import {
  AppointmentModel,
  connectDatabase,
  DoctorProfileModel,
  HomeVisitModel,
  PaymentModel,
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
  VIDEO_CONSULT_CONFIG,
} from "@zindagi/shared";
import { getNextSundayDate } from "@/lib/sunday/date-utils";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { formatPhoneForDisplay, safeDisplayText } from "@/server/lib/decrypt-pii";

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
    type: { $in: [AppointmentTypes.ONLINE, AppointmentTypes.CLINIC] },
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
  totalEarnings: number;
  earningsThisMonth: number;
};

export type DoctorEarningRow = {
  id: string;
  type: string;
  completedAt: string;
  amount: number;
  currency: string;
  patient: { id: string; name: string };
};

export type DoctorEarningsDetail = {
  totalEarnings: number;
  earningsThisMonth: number;
  completedPaidConsults: number;
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

async function loadDoctorEarningsTotals(profileId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const completedAppts = await AppointmentModel.find(
    mongoFilter({
      doctorId: profileId,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      status: AppointmentStatuses.COMPLETED,
      paymentId: { $exists: true, $ne: null },
    }),
  )
    .select("paymentId completedAt")
    .lean();

  const paymentIds = [
    ...new Set(
      completedAppts
        .map((a) => a.paymentId?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (!paymentIds.length) {
    return { totalEarnings: 0, earningsThisMonth: 0 };
  }

  const payments = await PaymentModel.find(
    mongoFilter({ _id: { $in: mongoObjectIds(paymentIds) }, status: PaymentStatuses.PAID }),
  )
    .select("_id amount")
    .lean();
  const paymentAmounts = new Map(
    payments.map((p) => [p._id.toString(), p.amount ?? 0]),
  );

  let totalEarnings = 0;
  let earningsThisMonth = 0;

  for (const appt of completedAppts) {
    const paymentId = appt.paymentId?.toString();
    if (!paymentId) continue;
    const amount = paymentAmounts.get(paymentId) ?? 0;
    if (!amount) continue;

    totalEarnings += amount;
    if (appt.completedAt && appt.completedAt >= startOfMonth) {
      earningsThisMonth += amount;
    }
  }

  return { totalEarnings, earningsThisMonth };
}

export async function getDoctorDashboardSummary(
  userId: string,
): Promise<DoctorDashboardSummary> {
  const { profile } = await getDoctorProfileForUser(userId);
  const now = new Date();
  const sundayDate = getNextSundayDate();
  const sundayEnd = new Date(sundayDate.getTime() + 24 * 60 * 60 * 1000);

  const [patientIds, pendingRequests, sundayQueue, homeVisitRequests, earnings] =
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
      loadDoctorEarningsTotals(profile._id.toString()),
    ]);

  return {
    patients: patientIds.length,
    pendingRequests,
    sundayQueue,
    homeVisitRequests,
    totalEarnings: earnings.totalEarnings,
    earningsThisMonth: earnings.earningsThisMonth,
  };
}

export async function getDoctorEarnings(userId: string): Promise<DoctorEarningsDetail> {
  const { profile } = await getDoctorProfileForUser(userId);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const completedAppts = await AppointmentModel.find(
    mongoFilter({
      doctorId: profile._id,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      status: AppointmentStatuses.COMPLETED,
      paymentId: { $exists: true, $ne: null },
    }),
  )
    .populate("patientId", "name")
    .sort({ completedAt: -1 })
    .limit(100)
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
        mongoFilter({ _id: { $in: mongoObjectIds(paymentIds) }, status: PaymentStatuses.PAID }),
      )
        .select("_id amount currency")
        .lean()
    : [];

  const paymentMap = new Map(
    payments.map((p) => [
      p._id.toString(),
      { amount: p.amount ?? 0, currency: p.currency ?? "PKR" },
    ]),
  );

  let totalEarnings = 0;
  let earningsThisMonth = 0;
  const transactions: DoctorEarningRow[] = [];

  for (const appt of completedAppts) {
    const paymentId = appt.paymentId?.toString();
    if (!paymentId) continue;
    const payment = paymentMap.get(paymentId);
    if (!payment?.amount) continue;

    totalEarnings += payment.amount;
    if (appt.completedAt && appt.completedAt >= startOfMonth) {
      earningsThisMonth += payment.amount;
    }

    const patient = appt.patientId as
      | { _id?: { toString(): string }; name?: string }
      | null;

    transactions.push({
      id: appt._id.toString(),
      type: appt.type,
      completedAt: appt.completedAt?.toISOString() ?? appt.scheduledStart.toISOString(),
      amount: payment.amount,
      currency: payment.currency,
      patient: {
        id: patient?._id?.toString() ?? "",
        name: safeDisplayText(patient?.name) ?? "Patient",
      },
    });
  }

  return {
    totalEarnings,
    earningsThisMonth,
    completedPaidConsults: transactions.length,
    transactions,
  };
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
