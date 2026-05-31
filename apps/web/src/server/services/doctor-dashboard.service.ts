import {
  AppointmentModel,
  connectDatabase,
  DoctorProfileModel,
  HomeVisitModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  AppointmentTypes,
  HomeVisitServiceTypes,
  HomeVisitStatuses,
  Roles,
} from "@zindagi/shared";
import { getNextSundayDate } from "@/lib/sunday/date-utils";

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

export type DoctorDashboardSummary = {
  patients: number;
  pendingRequests: number;
  sundayQueue: number;
  homeVisitRequests: number;
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
  const profile = await DoctorProfileModel.findOne({ userId: user._id });
  if (!profile) {
    throw new AppError("Doctor profile not found", "NOT_FOUND", 404);
  }
  return { user, profile };
}

export async function getDoctorDashboardSummary(
  userId: string,
): Promise<DoctorDashboardSummary> {
  const { profile } = await getDoctorProfileForUser(userId);
  const now = new Date();
  const sundayDate = getNextSundayDate();
  const sundayEnd = new Date(sundayDate.getTime() + 24 * 60 * 60 * 1000);
  const cities = profile.coverageCities?.length
    ? profile.coverageCities
    : ["Lahore"];

  const [patientIds, pendingRequests, sundayQueue, homeVisitRequests] =
    await Promise.all([
      AppointmentModel.distinct("patientId", { doctorId: profile._id }),
      AppointmentModel.countDocuments({
        doctorId: profile._id,
        type: { $in: [AppointmentTypes.ONLINE, AppointmentTypes.CLINIC] },
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        scheduledStart: { $gte: now },
      }),
      AppointmentModel.countDocuments({
        doctorId: profile._id,
        type: AppointmentTypes.SUNDAY_FREE,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        scheduledStart: { $gte: sundayDate, $lt: sundayEnd },
      }),
      HomeVisitModel.countDocuments({
        serviceType: HomeVisitServiceTypes.DOCTOR_VISIT,
        status: { $in: ACTIVE_HOME_VISIT_STATUSES },
        "address.city": { $in: cities },
      }),
    ]);

  return {
    patients: patientIds.length,
    pendingRequests,
    sundayQueue,
    homeVisitRequests,
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
  const patients = await UserModel.find({ _id: { $in: patientIds } })
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
      name: patient?.name ?? "Patient",
      phone: patient?.phone ?? undefined,
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

  const appointments = await AppointmentModel.find({
    doctorId: profile._id,
    type: { $in: [AppointmentTypes.ONLINE, AppointmentTypes.CLINIC] },
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    scheduledStart: { $gte: now },
  })
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
        name: patient?.name ?? "Patient",
        phone: patient?.phone,
      },
      patientNotes: apt.patientNotes ?? undefined,
    };
  });
}

export async function listDoctorHomeVisitRequests(
  userId: string,
): Promise<DoctorHomeVisitRow[]> {
  const { profile } = await getDoctorProfileForUser(userId);
  const cities = profile.coverageCities?.length
    ? profile.coverageCities
    : ["Lahore"];

  const visits = await HomeVisitModel.find({
    serviceType: HomeVisitServiceTypes.DOCTOR_VISIT,
    status: { $in: ACTIVE_HOME_VISIT_STATUSES },
    "address.city": { $in: cities },
  })
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
        line: visit.address.line,
        city: visit.address.city,
      },
      patient: patient?._id
        ? {
            id: patient._id.toString(),
            name: patient.name ?? "Patient",
            phone: patient.phone,
          }
        : undefined,
      patientNotes: visit.patientNotes ?? undefined,
      pricing: {
        total: visit.pricing.total,
        currency: visit.pricing.currency,
      },
    };
  });
}
