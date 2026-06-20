import bcrypt from "bcryptjs";
import {
  connectDatabase,
  AppointmentModel,
  DoctorProfileModel,
  HomeVisitModel,
  PaymentModel,
  SundaySlotTemplateModel,
  UserModel,
  type DoctorProfileDocument,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  HomeVisitServiceTypes,
  HomeVisitStatuses,
  PaymentStatuses,
  Roles,
  SUNDAY_CONSULT_CONFIG,
  VerificationStatuses,
  emailLookupHash,
} from "@zindagi/shared";
import type { z } from "zod";
import type {
  adminCreateDoctorSchema,
  adminUpdateDoctorSchema,
} from "@zindagi/validators";
import { normalizePhoneDigits, toPakistaniLocalPhone } from "@zindagi/validators";
import { getNextSundayDate } from "@/lib/sunday/date-utils";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { mapUserPii, revealPii } from "@/server/lib/decrypt-pii";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { SundayConsultService } from "./sunday-consult.service";
import { decideDoctorVerification } from "./doctor-verification.service";
import {
  calculateStaffNetEarnings,
  getDoctorCommissionRatesByProfileIds,
  type DoctorCommissionRates,
} from "./commission.service";

type CreateDoctorInput = z.infer<typeof adminCreateDoctorSchema>;
type UpdateDoctorInput = z.infer<typeof adminUpdateDoctorSchema>;

const DEFAULT_WEEKLY_AVAILABILITY = [
  { dayOfWeek: 1, startTimeLocal: "09:00", endTimeLocal: "17:00" },
  { dayOfWeek: 2, startTimeLocal: "09:00", endTimeLocal: "17:00" },
  { dayOfWeek: 3, startTimeLocal: "09:00", endTimeLocal: "17:00" },
  { dayOfWeek: 4, startTimeLocal: "09:00", endTimeLocal: "17:00" },
  { dayOfWeek: 5, startTimeLocal: "09:00", endTimeLocal: "17:00" },
  { dayOfWeek: 6, startTimeLocal: "09:00", endTimeLocal: "13:00" },
];

const BCRYPT_ROUNDS = 12;

const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
];

function formatPhoneForDisplay(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = normalizePhoneDigits(phone);
  if (!digits) return undefined;
  return toPakistaniLocalPhone(digits);
}

async function generateUniqueSlug(name: string, profileId: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "doctor";

  let slug = base;
  let counter = 0;
  while (
    await DoctorProfileModel.findOne({
      slug,
      _id: { $ne: profileId },
    } as Record<string, unknown>).lean()
  ) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

export type AdminDoctorStats = {
  upcomingToday: number;
  activeConsults: number;
  completedTotal: number;
  completedThisMonth: number;
  totalEarnings: number;
  earningsThisMonth: number;
  isWorkingNow: boolean;
};

export type AdminDoctorRow = {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  slug?: string;
  pmdcNumber?: string;
  specialties: string[];
  verificationStatus: string;
  isListed: boolean;
  isActive: boolean;
  sundayConsultEnabled: boolean;
  homeVisitEnabled: boolean;
  homeVisitFee: number;
  consultationFee: number;
  onlineCommissionPercent: number | null;
  homeVisitCommissionPercent: number | null;
  effectiveOnlineCommissionPercent: number;
  effectiveHomeVisitCommissionPercent: number;
  ratingAvg: number;
  ratingCount: number;
  weeklyAvailability: { dayOfWeek: number; startTimeLocal: string; endTimeLocal: string }[];
  stats: AdminDoctorStats;
  accountability: AdminDoctorAccountability;
};

export type AdminDoctorAccountability = {
  totalMisses: number;
  currentMonthKey?: string;
  currentMonthMisses: number;
  lastWarningAt?: string;
  autoRestrictedAt?: string;
};

const EMPTY_ACCOUNTABILITY: AdminDoctorAccountability = {
  totalMisses: 0,
  currentMonthMisses: 0,
};

const EMPTY_STATS: AdminDoctorStats = {
  upcomingToday: 0,
  activeConsults: 0,
  completedTotal: 0,
  completedThisMonth: 0,
  totalEarnings: 0,
  earningsThisMonth: 0,
  isWorkingNow: false,
};

function mapDoctorRow(
  profile: {
    _id: { toString(): string };
    userId: {
      _id?: { toString(): string };
      name?: string;
      email?: string;
      phone?: string;
      avatarUrl?: string;
      isActive?: boolean;
    };
    slug?: string;
    pmdcNumber?: string;
    specialties?: string[];
    verificationStatus?: string;
    isListed?: boolean;
    sundayConsultEnabled?: boolean;
    homeVisitEnabled?: boolean;
    homeVisitFee?: number;
    consultationFee?: number;
    onlineCommissionPercent?: number | null;
    homeVisitCommissionPercent?: number | null;
    commissionPercent?: number | null;
    ratingAvg?: number;
    ratingCount?: number;
    weeklyAvailability?: AdminDoctorRow["weeklyAvailability"];
    accountability?: {
      totalMisses?: number;
      currentMonthKey?: string;
      currentMonthMisses?: number;
      lastWarningAt?: Date | string;
      autoRestrictedAt?: Date | string;
    };
  },
  stats: AdminDoctorStats = EMPTY_STATS,
  effectiveRates: DoctorCommissionRates = { online: 70, homeVisit: 70 },
): AdminDoctorRow {
  const user = profile.userId ?? {};
  const pii = mapUserPii(user);
  const name = pii.name;
  return {
    id: profile._id.toString(),
    userId: user._id?.toString() ?? "",
    name,
    email: pii.email,
    phone: formatPhoneForDisplay(pii.phone),
    avatarUrl: resolveDoctorPortrait(name, user.avatarUrl),
    slug: profile.slug ?? undefined,
    pmdcNumber: revealPii(profile.pmdcNumber),
    specialties: profile.specialties ?? [],
    verificationStatus: profile.verificationStatus ?? VerificationStatuses.PENDING,
    isListed: profile.isListed ?? false,
    isActive: user.isActive !== false,
    sundayConsultEnabled: profile.sundayConsultEnabled ?? false,
    homeVisitEnabled: profile.homeVisitEnabled ?? false,
    homeVisitFee: profile.homeVisitFee ?? 0,
    consultationFee: profile.consultationFee ?? 0,
    onlineCommissionPercent: profile.onlineCommissionPercent ?? null,
    homeVisitCommissionPercent: profile.homeVisitCommissionPercent ?? null,
    effectiveOnlineCommissionPercent: effectiveRates.online,
    effectiveHomeVisitCommissionPercent: effectiveRates.homeVisit,
    ratingAvg: profile.ratingAvg ?? 0,
    ratingCount: profile.ratingCount ?? 0,
    weeklyAvailability: profile.weeklyAvailability ?? [],
    stats,
    accountability: profile.accountability
      ? {
          totalMisses: profile.accountability.totalMisses ?? 0,
          currentMonthKey: profile.accountability.currentMonthKey,
          currentMonthMisses: profile.accountability.currentMonthMisses ?? 0,
          lastWarningAt: profile.accountability.lastWarningAt
            ? new Date(profile.accountability.lastWarningAt).toISOString()
            : undefined,
          autoRestrictedAt: profile.accountability.autoRestrictedAt
            ? new Date(profile.accountability.autoRestrictedAt).toISOString()
            : undefined,
        }
      : { ...EMPTY_ACCOUNTABILITY },
  };
}

async function loadUsersById(userIds: string[]) {
  if (!userIds.length) return new Map<string, Record<string, unknown>>();
  const users = await UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(userIds) } }))
    .select("name email phone isActive avatarUrl")
    .lean();
  return new Map(users.map((u) => [u._id.toString(), u as Record<string, unknown>]));
}

async function loadDoctorStatsBatch(
  doctorProfileIds: string[],
): Promise<Map<string, AdminDoctorStats>> {
  const statsMap = new Map<string, AdminDoctorStats>();
  for (const id of doctorProfileIds) {
    statsMap.set(id, { ...EMPTY_STATS });
  }
  if (!doctorProfileIds.length) return statsMap;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const doctorObjectIds = mongoObjectIds(doctorProfileIds);

  const [commissionRatesByProfile, profileUsers] = await Promise.all([
    getDoctorCommissionRatesByProfileIds(doctorProfileIds),
    DoctorProfileModel.find(
      mongoFilter({ _id: { $in: mongoObjectIds(doctorProfileIds) } }),
    )
      .select("userId")
      .lean(),
  ]);
  const userIdByProfileId = new Map(
    profileUsers.map((p) => [p._id.toString(), p.userId?.toString() ?? ""]),
  );
  const profileIdByUserId = new Map(
    profileUsers
      .map((p) => [p.userId?.toString() ?? "", p._id.toString()] as const)
      .filter(([userId]) => Boolean(userId)),
  );

  const baseFilter = mongoFilter({
    doctorId: { $in: doctorObjectIds },
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  });

  const [appointments, completedAppts, completedHomeVisits] = await Promise.all([
    AppointmentModel.find(baseFilter)
      .select("doctorId status scheduledStart completedAt")
      .lean(),
    AppointmentModel.find(
      mongoFilter({
        doctorId: { $in: doctorObjectIds },
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
        status: AppointmentStatuses.COMPLETED,
        paymentId: { $exists: true, $ne: null },
      }),
    )
      .select("doctorId paymentId completedAt")
      .lean(),
    HomeVisitModel.find(
      mongoFilter({
        serviceType: HomeVisitServiceTypes.DOCTOR_VISIT,
        assignedStaffId: {
          $in: [...userIdByProfileId.values()].filter(Boolean),
        },
        status: HomeVisitStatuses.COMPLETED,
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      }),
    )
      .select("assignedStaffId paymentId pricing completedAt")
      .lean(),
  ]);

  for (const appt of appointments) {
    const id = appt.doctorId?.toString();
    if (!id) continue;
    const current = statsMap.get(id) ?? { ...EMPTY_STATS };

    if (
      ACTIVE_APPOINTMENT_STATUSES.includes(
        appt.status as (typeof ACTIVE_APPOINTMENT_STATUSES)[number],
      ) &&
      appt.scheduledStart >= startOfDay &&
      appt.scheduledStart < endOfDay
    ) {
      current.upcomingToday += 1;
    }
    if (appt.status === AppointmentStatuses.IN_PROGRESS) {
      current.activeConsults += 1;
      current.isWorkingNow = true;
    }
    if (appt.status === AppointmentStatuses.COMPLETED) {
      current.completedTotal += 1;
      if (appt.completedAt && appt.completedAt >= startOfMonth) {
        current.completedThisMonth += 1;
      }
    }
    statsMap.set(id, current);
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

  const paymentAmounts = new Map<string, number>();
  if (paymentIds.length) {
    const payments = await PaymentModel.find(
      mongoFilter({ _id: { $in: mongoObjectIds(paymentIds) }, status: PaymentStatuses.PAID }),
    )
      .select("_id amount")
      .lean();
    for (const payment of payments) {
      paymentAmounts.set(payment._id.toString(), payment.amount ?? 0);
    }
  }

  const addEarnings = (
    profileId: string,
    grossAmount: number,
    completedAt: Date | null | undefined,
    channel: "online" | "homeVisit",
  ) => {
    if (!grossAmount) return;
    const rates = commissionRatesByProfile.get(profileId) ?? {
      online: 70,
      homeVisit: 70,
    };
    const commissionPercent = channel === "online" ? rates.online : rates.homeVisit;
    const netAmount = calculateStaffNetEarnings(grossAmount, commissionPercent);
    const current = statsMap.get(profileId) ?? { ...EMPTY_STATS };
    current.totalEarnings += netAmount;
    if (completedAt && completedAt >= startOfMonth) {
      current.earningsThisMonth += netAmount;
    }
    statsMap.set(profileId, current);
  };

  for (const appt of completedAppts) {
    const doctorId = appt.doctorId?.toString();
    const paymentId = appt.paymentId?.toString();
    if (!doctorId || !paymentId) continue;
    addEarnings(
      doctorId,
      paymentAmounts.get(paymentId) ?? 0,
      appt.completedAt,
      "online",
    );
  }

  for (const visit of completedHomeVisits) {
    const staffUserId = visit.assignedStaffId?.toString();
    if (!staffUserId) continue;
    const profileId = profileIdByUserId.get(staffUserId);
    if (!profileId) continue;
    const paymentId = visit.paymentId?.toString();
    const grossAmount = paymentId
      ? (paymentAmounts.get(paymentId) ?? visit.pricing?.total ?? 0)
      : (visit.pricing?.total ?? 0);
    addEarnings(profileId, grossAmount, visit.completedAt, "homeVisit");
  }

  return statsMap;
}

async function buildAdminDoctorRow(profileId: string): Promise<AdminDoctorRow> {
  const profile = await DoctorProfileModel.findById(profileId).lean();
  if (!profile) throw new AppError("Doctor not found", "NOT_FOUND", 404);

  const userId = profile.userId?.toString();
  const users = userId ? await loadUsersById([userId]) : new Map();
  const [statsMap, commissionRates] = await Promise.all([
    loadDoctorStatsBatch([profileId]),
    getDoctorCommissionRatesByProfileIds([profileId]),
  ]);

  return mapDoctorRow(
    {
      ...profile,
      userId: users.get(userId ?? "") ?? {},
    } as Parameters<typeof mapDoctorRow>[0],
    statsMap.get(profileId) ?? EMPTY_STATS,
    commissionRates.get(profileId) ?? { online: 70, homeVisit: 70 },
  );
}

function applyRestrictedStatus(profile: DoctorProfileDocument) {
  profile.verificationStatus = VerificationStatuses.RESTRICTED;
  profile.isListed = false;
  profile.videoConsultEnabled = false;
  profile.sundayConsultEnabled = false;
  profile.homeVisitEnabled = false;
}

export async function listAllDoctors(search?: string): Promise<AdminDoctorRow[]> {
  await connectDatabase();

  let userFilter: Record<string, unknown> | undefined;
  if (search?.trim()) {
    const q = search.trim();
    const users = await UserModel.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ],
      roles: Roles.DOCTOR,
    })
      .select("_id")
      .lean();
    userFilter = { userId: { $in: users.map((u) => u._id) } };
  }

  const profiles = await DoctorProfileModel.find(userFilter ?? {})
    .sort({ createdAt: -1 })
    .lean();

  const userIds = profiles.map((p) => p.userId?.toString()).filter(Boolean) as string[];
  const profileIds = profiles.map((p) => p._id.toString());

  const [userMap, statsMap, commissionRates] = await Promise.all([
    loadUsersById(userIds),
    loadDoctorStatsBatch(profileIds),
    getDoctorCommissionRatesByProfileIds(profileIds),
  ]);

  return profiles.map((profile) => {
    const id = profile._id.toString();
    const userId = profile.userId?.toString() ?? "";
    return mapDoctorRow(
      {
        ...profile,
        userId: userMap.get(userId) ?? {},
      } as Parameters<typeof mapDoctorRow>[0],
      statsMap.get(id) ?? EMPTY_STATS,
      commissionRates.get(id) ?? { online: 70, homeVisit: 70 },
    );
  });
}

export async function adminCreateDoctor(
  adminUserId: string,
  input: CreateDoctorInput,
): Promise<AdminDoctorRow> {
  await connectDatabase();
  const email = input.email.toLowerCase();

  const existing = await UserModel.findOne({ emailLookup: emailLookupHash(email) });
  if (existing) {
    throw new AppError("Email already in use", "CONFLICT", 409);
  }

  const passwordHash = await bcrypt.hash(
    input.password ?? "Doctor@123",
    BCRYPT_ROUNDS,
  );

  const user = await UserModel.create({
    name: input.name,
    email,
    phone: input.phone,
    passwordHash,
    roles: [Roles.DOCTOR],
    authProviders: ["credentials"],
    emailVerified: new Date(),
    onboardingCompleted: true,
    isActive: true,
  });

  const profile = (await DoctorProfileModel.create({
    userId: user._id,
    pmdcNumber: input.pmdcNumber,
    pmdcVerified: true,
    specialties: input.specialties,
    verificationStatus: VerificationStatuses.APPROVED,
    verifiedBy: adminUserId,
    verifiedAt: new Date(),
    isListed: true,
    videoConsultEnabled: true,
    consultationFee: 2500,
    weeklyAvailability: DEFAULT_WEEKLY_AVAILABILITY,
    sundayConsultEnabled: input.sundayConsultEnabled ?? false,
    homeVisitEnabled: true,
    coverageCities: ["Lahore"],
  } as Record<string, unknown>)) as DoctorProfileDocument;

  const slug = await generateUniqueSlug(input.name, profile._id.toString());
  await DoctorProfileModel.findByIdAndUpdate(profile._id, { $set: { slug } });

  if (input.sundayConsultEnabled) {
    await SundaySlotTemplateModel.findOneAndUpdate(
      { doctorId: profile._id } as Record<string, unknown>,
      {
        $set: {
          startTimeLocal: "09:00",
          endTimeLocal: "12:00",
          slotDurationMins: SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins,
          maxSlots: 10,
          dayOfWeek: SUNDAY_CONSULT_CONFIG.dayOfWeek,
          timezone: SUNDAY_CONSULT_CONFIG.timezone,
          isActive: true,
        },
      },
      { upsert: true },
    );
    await SundayConsultService.materializeInstance(
      profile._id.toString(),
      getNextSundayDate(),
    );
  }

  return buildAdminDoctorRow(profile._id.toString());
}

export async function adminUpdateDoctor(
  adminUserId: string,
  doctorProfileId: string,
  input: UpdateDoctorInput,
): Promise<AdminDoctorRow> {
  await connectDatabase();
  const profile = await DoctorProfileModel.findById(doctorProfileId);
  if (!profile) throw new AppError("Doctor not found", "NOT_FOUND", 404);

  if (input.verificationStatus === VerificationStatuses.APPROVED) {
    await decideDoctorVerification(adminUserId, doctorProfileId, "approve");
  } else if (input.verificationStatus === VerificationStatuses.REJECTED) {
    await decideDoctorVerification(
      adminUserId,
      doctorProfileId,
      "reject",
      input.rejectionReason,
    );
  } else if (input.verificationStatus === VerificationStatuses.RESTRICTED) {
    applyRestrictedStatus(profile);
    await profile.save();
  }

  const refreshed = await DoctorProfileModel.findById(doctorProfileId);
  if (!refreshed) throw new AppError("Doctor not found", "NOT_FOUND", 404);

  if (input.isListed !== undefined) {
    if (refreshed.verificationStatus === VerificationStatuses.RESTRICTED) {
      throw new AppError(
        "Cannot list a restricted doctor — restore approved status first",
        "VALIDATION_ERROR",
        400,
      );
    }
    refreshed.isListed = input.isListed;
    refreshed.videoConsultEnabled = input.isListed;
  }
  if (input.sundayConsultEnabled !== undefined) {
    if (input.sundayConsultEnabled && refreshed.verificationStatus === VerificationStatuses.RESTRICTED) {
      throw new AppError(
        "Cannot enable services for a restricted doctor",
        "VALIDATION_ERROR",
        400,
      );
    }
    refreshed.sundayConsultEnabled = input.sundayConsultEnabled;
  }
  if (input.homeVisitEnabled !== undefined) {
    if (input.homeVisitEnabled && refreshed.verificationStatus === VerificationStatuses.RESTRICTED) {
      throw new AppError(
        "Cannot enable services for a restricted doctor",
        "VALIDATION_ERROR",
        400,
      );
    }
    refreshed.homeVisitEnabled = input.homeVisitEnabled;
  }
  if (input.homeVisitFee !== undefined) {
    refreshed.homeVisitFee = input.homeVisitFee;
  }
  if (input.onlineCommissionPercent !== undefined) {
    refreshed.onlineCommissionPercent = input.onlineCommissionPercent;
  }
  if (input.homeVisitCommissionPercent !== undefined) {
    refreshed.homeVisitCommissionPercent = input.homeVisitCommissionPercent;
  }
  if (input.commissionPercent !== undefined) {
    refreshed.commissionPercent = input.commissionPercent;
  }
  if (input.weeklyAvailability !== undefined) {
    refreshed.set("weeklyAvailability", input.weeklyAvailability);
  }

  await refreshed.save();

  if (input.isActive !== undefined) {
    await UserModel.findByIdAndUpdate(refreshed.userId, {
      $set: { isActive: input.isActive },
    });
  }

  if (input.sundayMaxSlots !== undefined || input.sundaySlotDurationMins !== undefined) {
    const template = await SundaySlotTemplateModel.findOne({
      doctorId: refreshed._id,
    } as Record<string, unknown>);
    if (template) {
      if (input.sundayMaxSlots !== undefined) template.maxSlots = input.sundayMaxSlots;
      if (input.sundaySlotDurationMins !== undefined) {
        template.slotDurationMins = input.sundaySlotDurationMins;
      }
      await template.save();
    } else if (refreshed.sundayConsultEnabled) {
      await SundaySlotTemplateModel.create({
        doctorId: refreshed._id,
        startTimeLocal: "09:00",
        endTimeLocal: "12:00",
        slotDurationMins: input.sundaySlotDurationMins ?? 10,
        maxSlots: input.sundayMaxSlots ?? 10,
        dayOfWeek: SUNDAY_CONSULT_CONFIG.dayOfWeek,
        timezone: SUNDAY_CONSULT_CONFIG.timezone,
        isActive: true,
      } as Record<string, unknown>);
    }
  }

  return buildAdminDoctorRow(refreshed._id.toString());
}

export async function getDoctorDetailForAdmin(
  doctorProfileId: string,
): Promise<AdminDoctorRow> {
  await connectDatabase();
  return buildAdminDoctorRow(doctorProfileId);
}

export async function listDoctorsForReassign() {
  await connectDatabase();
  const profiles = await DoctorProfileModel.find({
    verificationStatus: VerificationStatuses.APPROVED,
    isListed: true,
  }).lean();

  const userIds = profiles.map((p) => p.userId?.toString()).filter(Boolean) as string[];
  const userMap = await loadUsersById(userIds);

  return profiles.map((p) => {
    const userId = p.userId?.toString() ?? "";
    const pii = mapUserPii(userMap.get(userId) ?? {});
    return {
      id: p._id.toString(),
      name: pii.name,
      specialties: p.specialties ?? [],
    };
  });
}
