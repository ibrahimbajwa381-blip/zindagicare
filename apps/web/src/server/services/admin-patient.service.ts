import {
  connectDatabase,
  UserModel,
  PatientProfileModel,
  AppointmentModel,
  HomeVisitModel,
  PaymentModel,
  DoctorProfileModel,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  HomeVisitStatuses,
  PaymentStatuses,
  Roles,
  STAFF_ROLES,
  isPatientOnly,
} from "@zindagi/shared";
import type { z } from "zod";
import type { adminUpdatePatientSchema } from "@zindagi/validators";
import { normalizePhoneDigits, toPakistaniLocalPhone } from "@zindagi/validators";
import { mapUserPii, revealPii } from "@/server/lib/decrypt-pii";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";

type UpdatePatientInput = z.infer<typeof adminUpdatePatientSchema>;

const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatuses.PENDING,
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
];

function formatPhoneForDisplay(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = normalizePhoneDigits(phone);
  if (!digits) return undefined;
  return toPakistaniLocalPhone(digits);
}

function formatDateForDisplay(value?: Date | string | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function isCurrentlyBanned(bannedUntil?: Date | null): boolean {
  return Boolean(bannedUntil && bannedUntil > new Date());
}

export type AdminPatientStats = {
  totalAppointments: number;
  upcomingAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  homeVisitsTotal: number;
  homeVisitsActive: number;
  totalSpend: number;
  spendThisMonth: number;
};

export type AdminPatientRow = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  createdAt: string;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  noShowCount: number;
  isBanned: boolean;
  sundayBanned: boolean;
  bannedUntil?: string;
  stats: AdminPatientStats;
};

export type AdminPatientAppointmentRow = {
  id: string;
  type: string;
  status: string;
  scheduledStart: string;
  completedAt?: string;
  doctorName?: string;
  isOnline: boolean;
};

export type AdminPatientHomeVisitRow = {
  id: string;
  serviceType: string;
  status: string;
  scheduledAt: string;
  completedAt?: string;
  address: { line: string; city: string };
  pricing: { total: number; currency: string };
};

export type AdminPatientDetail = AdminPatientRow & {
  locale: "en" | "ur";
  memberSince: string;
  sundayBannedUntil?: string;
  profile?: {
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    defaultCity?: string;
    allergies: string[];
    chronicConditions: string[];
    emergencyContact?: {
      name?: string;
      phone?: string;
      relation?: string;
    };
  };
  recentAppointments: AdminPatientAppointmentRow[];
  recentHomeVisits: AdminPatientHomeVisitRow[];
};

const EMPTY_STATS: AdminPatientStats = {
  totalAppointments: 0,
  upcomingAppointments: 0,
  completedAppointments: 0,
  cancelledAppointments: 0,
  homeVisitsTotal: 0,
  homeVisitsActive: 0,
  totalSpend: 0,
  spendThisMonth: 0,
};

function mapPatientRow(
  user: {
    _id: { toString(): string };
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    metadata?: { city?: string; locale?: string } | null;
    createdAt?: Date;
    isActive?: boolean;
    emailVerified?: Date | null;
    phoneVerified?: Date | null;
    noShowCount?: number;
    bannedUntil?: Date | null;
    sundayBannedUntil?: Date | null;
  },
  stats: AdminPatientStats = EMPTY_STATS,
): AdminPatientRow {
  const pii = mapUserPii(user);
  return {
    id: user._id.toString(),
    name: pii.name,
    email: pii.email,
    phone: formatPhoneForDisplay(pii.phone),
    city: user.metadata?.city,
    createdAt: user.createdAt?.toISOString() ?? new Date().toISOString(),
    isActive: user.isActive !== false,
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified),
    noShowCount: user.noShowCount ?? 0,
    isBanned: isCurrentlyBanned(user.bannedUntil),
    sundayBanned: isCurrentlyBanned(user.sundayBannedUntil),
    bannedUntil: user.bannedUntil?.toISOString(),
    stats,
  };
}

async function loadPatientStatsBatch(patientIds: string[]): Promise<Map<string, AdminPatientStats>> {
  const statsMap = new Map<string, AdminPatientStats>();
  for (const id of patientIds) {
    statsMap.set(id, { ...EMPTY_STATS });
  }
  if (!patientIds.length) return statsMap;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const patientObjectIds = mongoObjectIds(patientIds);

  const baseFilter = mongoFilter({
    patientId: { $in: patientObjectIds },
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  });

  const activeHomeVisitStatuses = [
    HomeVisitStatuses.REQUESTED,
    HomeVisitStatuses.ASSIGNED,
    HomeVisitStatuses.EN_ROUTE,
    HomeVisitStatuses.ARRIVED,
  ];

  const [appointments, homeVisits, payments] = await Promise.all([
    AppointmentModel.find(baseFilter).select("patientId status scheduledStart").lean(),
    HomeVisitModel.find(baseFilter).select("patientId status").lean(),
    PaymentModel.find(
      mongoFilter({
        userId: { $in: patientObjectIds },
        status: PaymentStatuses.PAID,
      }),
    )
      .select("userId amount paidAt createdAt")
      .lean(),
  ]);

  for (const appt of appointments) {
    const id = appt.patientId?.toString();
    if (!id) continue;
    const current = statsMap.get(id) ?? { ...EMPTY_STATS };
    current.totalAppointments += 1;
    if (
      ACTIVE_APPOINTMENT_STATUSES.includes(appt.status as (typeof ACTIVE_APPOINTMENT_STATUSES)[number]) &&
      appt.scheduledStart >= now
    ) {
      current.upcomingAppointments += 1;
    }
    if (appt.status === AppointmentStatuses.COMPLETED) {
      current.completedAppointments += 1;
    }
    if (appt.status === AppointmentStatuses.CANCELLED) {
      current.cancelledAppointments += 1;
    }
    statsMap.set(id, current);
  }

  for (const visit of homeVisits) {
    const id = visit.patientId?.toString();
    if (!id) continue;
    const current = statsMap.get(id) ?? { ...EMPTY_STATS };
    current.homeVisitsTotal += 1;
    if (activeHomeVisitStatuses.includes(visit.status as (typeof activeHomeVisitStatuses)[number])) {
      current.homeVisitsActive += 1;
    }
    statsMap.set(id, current);
  }

  for (const payment of payments) {
    const id = payment.userId?.toString();
    if (!id) continue;
    const amount = payment.amount ?? 0;
    const paidAt = payment.paidAt ?? payment.createdAt;
    const current = statsMap.get(id) ?? { ...EMPTY_STATS };
    current.totalSpend += amount;
    if (paidAt && paidAt >= startOfMonth) {
      current.spendThisMonth += amount;
    }
    statsMap.set(id, current);
  }

  return statsMap;
}

async function loadDoctorNames(doctorProfileIds: string[]): Promise<Map<string, string>> {
  if (!doctorProfileIds.length) return new Map();

  const profiles = await DoctorProfileModel.find(
    mongoFilter({ _id: { $in: mongoObjectIds(doctorProfileIds) } }),
  )
    .select("userId")
    .lean();

  const userIds = profiles
    .map((p) => p.userId?.toString())
    .filter(Boolean) as string[];

  const users = userIds.length
    ? await UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(userIds) } }))
        .select("name")
        .lean()
    : [];

  const userNameMap = new Map(
    users.map((u) => [u._id.toString(), mapUserPii(u).name]),
  );

  const nameMap = new Map<string, string>();
  for (const profile of profiles) {
    const profileId = profile._id.toString();
    const userId = profile.userId?.toString() ?? "";
    nameMap.set(profileId, userNameMap.get(userId) ?? "Doctor");
  }
  return nameMap;
}

function mapPatientProfile(profile: {
  dateOfBirth?: Date | string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  defaultCity?: string | null;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: {
    name?: string | null;
    phone?: string | null;
    relation?: string | null;
  } | null;
}) {
  return {
    dateOfBirth: formatDateForDisplay(profile.dateOfBirth),
    gender: profile.gender ?? undefined,
    bloodGroup: profile.bloodGroup ?? undefined,
    defaultCity: profile.defaultCity ?? undefined,
    allergies: profile.allergies ?? [],
    chronicConditions: profile.chronicConditions ?? [],
    emergencyContact: profile.emergencyContact
      ? {
          name: revealPii(profile.emergencyContact.name),
          phone: formatPhoneForDisplay(revealPii(profile.emergencyContact.phone)),
          relation: profile.emergencyContact.relation ?? undefined,
        }
      : undefined,
  };
}

export async function listPatients(search?: string): Promise<AdminPatientRow[]> {
  await connectDatabase();

  const filter: Record<string, unknown> = {
    roles: { $all: [Roles.PATIENT], $nin: STAFF_ROLES },
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
    .select(
      "name email phone metadata createdAt isActive emailVerified phoneVerified noShowCount bannedUntil sundayBannedUntil",
    )
    .sort({ createdAt: -1 })
    .limit(150)
    .lean();

  const patientIds = users.map((u) => u._id.toString());
  const statsMap = await loadPatientStatsBatch(patientIds);

  return users.map((user) =>
    mapPatientRow(user, statsMap.get(user._id.toString()) ?? EMPTY_STATS),
  );
}

export async function getPatientDetail(patientId: string): Promise<AdminPatientDetail> {
  await connectDatabase();

  const user = await UserModel.findById(patientId).lean();
  if (!user || !isPatientOnly(user.roles)) {
    throw new AppError("Patient not found", "NOT_FOUND", 404);
  }

  const userId = user._id.toString();

  const [profile, appointments, homeVisits, statsMap] = await Promise.all([
    PatientProfileModel.findOne(mongoFilter({ userId: user._id })).lean(),
    AppointmentModel.find(mongoFilter({ patientId: userId, deletedAt: { $exists: false } }))
      .sort({ scheduledStart: -1 })
      .limit(25)
      .lean(),
    HomeVisitModel.find(mongoFilter({ patientId: userId, deletedAt: { $exists: false } }))
      .sort({ scheduledAt: -1 })
      .limit(15)
      .lean(),
    loadPatientStatsBatch([userId]),
  ]);

  const doctorIds = [
    ...new Set(
      appointments.map((a) => a.doctorId?.toString()).filter(Boolean) as string[],
    ),
  ];
  const doctorNames = await loadDoctorNames(doctorIds);

  const row = mapPatientRow(user, statsMap.get(userId) ?? EMPTY_STATS);

  return {
    ...row,
    locale: (user.metadata?.locale as "en" | "ur") ?? "en",
    memberSince: user.createdAt?.toISOString() ?? new Date().toISOString(),
    sundayBannedUntil: user.sundayBannedUntil?.toISOString(),
    profile: profile ? mapPatientProfile(profile) : undefined,
    recentAppointments: appointments.map((a) => ({
      id: a._id.toString(),
      type: a.type,
      status: a.status,
      scheduledStart: a.scheduledStart.toISOString(),
      completedAt: a.completedAt?.toISOString(),
      doctorName: doctorNames.get(a.doctorId?.toString() ?? ""),
      isOnline: a.isOnline ?? false,
    })),
    recentHomeVisits: homeVisits.map((visit) => ({
      id: visit._id.toString(),
      serviceType: visit.serviceType,
      status: visit.status,
      scheduledAt: visit.scheduledAt.toISOString(),
      completedAt: visit.completedAt?.toISOString(),
      address: {
        line: revealPii(visit.address?.line) ?? "",
        city: visit.address?.city ?? "Lahore",
      },
      pricing: {
        total: visit.pricing?.total ?? 0,
        currency: visit.pricing?.currency ?? "PKR",
      },
    })),
  };
}

export async function adminUpdatePatient(
  patientId: string,
  input: UpdatePatientInput,
): Promise<AdminPatientDetail> {
  await connectDatabase();

  const user = await UserModel.findById(patientId);
  if (!user || !isPatientOnly(user.roles)) {
    throw new AppError("Patient not found", "NOT_FOUND", 404);
  }

  if (input.isActive !== undefined) {
    user.isActive = input.isActive;
  }

  if (input.unban) {
    user.bannedUntil = undefined;
  }

  if (input.banDays !== undefined) {
    const until = new Date();
    until.setDate(until.getDate() + input.banDays);
    user.bannedUntil = until;
    user.isActive = true;
  }

  if (input.clearSundayBan) {
    user.sundayBannedUntil = undefined;
  }

  if (input.resetNoShowCount) {
    user.noShowCount = 0;
  }

  await user.save();

  return getPatientDetail(patientId);
}
