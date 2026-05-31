import {
  connectDatabase,
  UserModel,
  PatientProfileModel,
  AppointmentModel,
} from "@zindagi/database";
import { AppError, Roles } from "@zindagi/shared";

export type AdminPatientRow = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  createdAt: string;
  appointmentCount: number;
};

export type AdminPatientDetail = AdminPatientRow & {
  profile?: {
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    defaultCity?: string;
  };
  recentAppointments: {
    id: string;
    type: string;
    status: string;
    scheduledStart: string;
    doctorName?: string;
  }[];
};

export async function listPatients(search?: string): Promise<AdminPatientRow[]> {
  await connectDatabase();

  const filter: Record<string, unknown> = {
    roles: Roles.PATIENT,
    isActive: { $ne: false },
    deletedAt: null,
  };

  if (search?.trim()) {
    const q = search.trim();
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } },
    ];
  }

  const users = await UserModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const userIds = users.map((u) => u._id);
  const counts = await AppointmentModel.aggregate([
    { $match: { patientId: { $in: userIds } } },
    { $group: { _id: "$patientId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count as number]));

  return users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email ?? undefined,
    phone: u.phone ?? undefined,
    city: u.metadata?.city ?? undefined,
    createdAt: u.createdAt?.toISOString() ?? new Date().toISOString(),
    appointmentCount: countMap.get(u._id.toString()) ?? 0,
  }));
}

export async function getPatientDetail(patientId: string): Promise<AdminPatientDetail> {
  await connectDatabase();

  const user = await UserModel.findById(patientId).lean();
  if (!user?.roles.includes(Roles.PATIENT)) {
    throw new AppError("Patient not found", "NOT_FOUND", 404);
  }

  const [profile, appointments, appointmentCount] = await Promise.all([
    PatientProfileModel.findOne({ userId: user._id.toString() }).lean(),
    AppointmentModel.find({ patientId: user._id.toString() })
      .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
      .sort({ scheduledStart: -1 })
      .limit(20)
      .lean(),
    AppointmentModel.countDocuments({ patientId: user._id.toString() }),
  ]);

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
    city: user.metadata?.city ?? profile?.defaultCity ?? undefined,
    createdAt: user.createdAt?.toISOString() ?? new Date().toISOString(),
    appointmentCount,
    profile: profile
      ? {
          dateOfBirth: profile.dateOfBirth?.toISOString(),
          gender: profile.gender ?? undefined,
          bloodGroup: profile.bloodGroup ?? undefined,
          defaultCity: profile.defaultCity ?? undefined,
        }
      : undefined,
    recentAppointments: appointments.map((a) => {
      const doctor = a.doctorId as {
        userId?: { name?: string };
      } | null;
      return {
        id: a._id.toString(),
        type: a.type,
        status: a.status,
        scheduledStart: a.scheduledStart.toISOString(),
        doctorName: doctor?.userId?.name,
      };
    }),
  };
}
