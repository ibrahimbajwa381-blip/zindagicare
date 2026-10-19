import {
  connectDatabase,
  HomeVisitModel,
  StaffProfileModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  calculateNurseVisitEarnings,
  HomeVisitStatuses,
  LAHORE_GEO,
  LAUNCH_CITY,
  PROVIDER_AGREEMENT_VERSION,
  Roles,
  VerificationStatuses,
  phoneLookupHash,
} from "@zindagi/shared";
import {
  normalizePhoneDigits,
  toPakistaniLocalPhone,
  type NurseVerificationInput,
  type UpdateNursePortfolioInput,
  type UpdateNurseProfileInput,
} from "@zindagi/validators";
import { normalizePakistaniPhone } from "@/lib/auth/phone";
import { mongoFilter } from "@/lib/mongo/query";
import {
  mapNursePortfolio,
  type NursePortfolio,
} from "@/lib/nurses/portfolio";
import { formatPhoneForDisplay, mapUserPii, safeDisplayText } from "@/server/lib/decrypt-pii";
import { recordAdminActivity } from "@/server/services/admin-activity.service";
import type {
  AdminNurseDetailDto,
  AdminNurseVisitRow,
} from "@/features/admin/types/nurse-admin";
import { cnicLast4, hashCnic } from "./auth.service";
import { getNurseCommissionPercentByUserId } from "./commission.service";
import {
  deleteNurseDocument,
  nurseDocumentStorageKeyFromUrl,
} from "./nurse-documents.storage";
import {
  deleteNurseAvatar,
  isNurseAvatarUrlForUser,
  nurseAvatarStorageKeyFromUrl,
} from "./nurse-avatar.storage";
import { ensureCanonicalNurseSlug } from "./nurse-slug.service";

async function deleteReplacedNurseAvatar(previousAvatarUrl: string | undefined) {
  if (!previousAvatarUrl) return;
  const previousKey = nurseAvatarStorageKeyFromUrl(previousAvatarUrl);
  if (!previousKey) return;
  try {
    await deleteNurseAvatar(previousKey);
  } catch {
    // best-effort cleanup; ignore failures (e.g., file already removed)
  }
}

async function deleteReplacedNurseDocuments(
  previous: Record<string, string | null | undefined> | undefined,
  next: Record<string, string | null | undefined>,
): Promise<void> {
  if (!previous) return;
  for (const [field, previousUrl] of Object.entries(previous)) {
    if (!previousUrl || previousUrl === next[field]) continue;
    const previousKey = nurseDocumentStorageKeyFromUrl(previousUrl);
    if (!previousKey) continue;
    try {
      await deleteNurseDocument(previousKey);
    } catch {
      // best-effort cleanup; ignore failures (e.g., file already removed)
    }
  }
}

const ACTIVE_VISIT_STATUSES = [
  HomeVisitStatuses.ASSIGNED,
  HomeVisitStatuses.EN_ROUTE,
  HomeVisitStatuses.ARRIVED,
];

export type NurseProfileDto = {
  user: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    city: string;
    memberSince: string;
    avatarUrl?: string;
  };
  publicProfile: {
    slug?: string;
    bio?: string;
    languages: string[];
  };
  portfolio: NursePortfolio;
  staff: {
    employeeCode?: string;
    isAvailable: boolean;
    verificationStatus: string;
    serviceArea: {
      city: string;
      area?: string;
      radiusKm: number;
      geo?: { lng: number; lat: number };
    };
    homeVisitEnabled: boolean;
    /** Fee the nurse set themselves; undefined means the platform rate applies. */
    homeVisitFee?: number;
  };
  verification: {
    status: string;
    submittedAt?: string;
    rejectionReason?: string;
    licenseNumber?: string;
    qualification?: string;
    experienceYears?: number;
    specialties?: string[];
    cnicLast4?: string;
  };
};

export type NurseDashboardSummary = {
  activeVisits: number;
  upcomingToday: number;
  completedTotal: number;
  completedThisMonth: number;
  /** Net earnings (nurse's share) from completed visits. */
  earningsTotal: number;
  earningsThisMonth: number;
  isAvailable: boolean;
};

async function loadNurseUser(userId: string) {
  await connectDatabase();
  const user = await UserModel.findById(userId);
  if (!user || user.deletedAt || user.isActive === false) {
    throw new AppError("User not found", "NOT_FOUND", 404);
  }
  if (!user.roles?.includes(Roles.NURSE)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  return user;
}

type NurseUserDoc = Awaited<ReturnType<typeof loadNurseUser>>;

/** Ensure a StaffProfile exists for the Nurse (covers legacy/seeded accounts). */
async function ensureStaffProfile(user: NurseUserDoc) {
  const existing = await StaffProfileModel.findOne(
    mongoFilter({ userId: user._id, staffType: Roles.NURSE }),
  );
  if (existing) return existing;

  return StaffProfileModel.create({
    userId: user._id.toString(),
    staffType: Roles.NURSE,
    isAvailable: true,
    verificationStatus: VerificationStatuses.PENDING,
    serviceAreas: [
      {
        city: user.metadata?.city ?? LAUNCH_CITY,
        geo: { type: "Point", coordinates: [LAHORE_GEO.lng, LAHORE_GEO.lat] },
        radiusKm: 15,
      },
    ],
  });
}

export async function getNurseProfile(userId: string): Promise<NurseProfileDto> {
  const user = await loadNurseUser(userId);
  const staff = await ensureStaffProfile(user);
  const area = staff.serviceAreas?.[0];
  const pii = mapUserPii(user);

  return {
    user: {
      id: user._id.toString(),
      name: pii.name,
      email: pii.email,
      phone: pii.phone,
      city: user.metadata?.city ?? area?.city ?? LAUNCH_CITY,
      memberSince: user.createdAt?.toISOString() ?? new Date().toISOString(),
      avatarUrl: user.avatarUrl ?? undefined,
    },
    publicProfile: {
      slug: staff.slug ?? undefined,
      bio: staff.bio ?? undefined,
      languages: staff.languages?.length ? staff.languages : ["English", "Urdu"],
    },
    portfolio: mapNursePortfolio(staff),
    staff: {
      employeeCode: staff.employeeCode ?? undefined,
      isAvailable: staff.isAvailable ?? true,
      verificationStatus: staff.verificationStatus ?? VerificationStatuses.PENDING,
      serviceArea: {
        city: area?.city ?? LAUNCH_CITY,
        area: area?.area ?? undefined,
        radiusKm: area?.radiusKm ?? 15,
        geo:
          area?.geo?.coordinates?.length === 2
            ? {
                lng: area.geo.coordinates[0],
                lat: area.geo.coordinates[1],
              }
            : undefined,
      },
      homeVisitEnabled: staff.homeVisitEnabled ?? false,
      homeVisitFee: staff.homeVisitFee ?? undefined,
    },
    verification: {
      status: staff.verificationStatus ?? VerificationStatuses.PENDING,
      submittedAt: staff.verificationSubmittedAt?.toISOString(),
      rejectionReason: staff.rejectionReason ?? undefined,
      licenseNumber: staff.licenseNumber ?? undefined,
      qualification: staff.qualification ?? undefined,
      experienceYears: staff.experienceYears ?? undefined,
      specialties: staff.specialties ?? undefined,
      cnicLast4: staff.cnicLast4 ?? undefined,
    },
  };
}

export async function updateNurseProfile(
  userId: string,
  data: UpdateNurseProfileInput,
): Promise<NurseProfileDto> {
  const user = await loadNurseUser(userId);
  const staff = await ensureStaffProfile(user);

  if (data.phone !== undefined) {
    const normalized = normalizePakistaniPhone(data.phone);
    const phoneLocal = toPakistaniLocalPhone(normalizePhoneDigits(data.phone));
    if (normalized !== user.phone && phoneLocal !== user.phone) {
      const existing = await UserModel.findOne({
        _id: { $ne: user._id },
        $or: [
          { phoneLookup: phoneLookupHash(normalized) },
          { phoneLookup: phoneLookupHash(phoneLocal) },
        ],
      });
      if (existing) {
        throw new AppError("Phone number already in use", "CONFLICT", 409, "phone");
      }
      user.phone = normalized;
    }
  }

  if (data.name !== undefined) {
    user.name = data.name.trim();
  }

  if (data.city !== undefined) {
    user.metadata = {
      ...user.metadata,
      locale: user.metadata?.locale ?? "en",
      city: data.city,
    };
  }

  let previousAvatarUrl: string | undefined;
  if (data.avatarUrl !== undefined) {
    if (!isNurseAvatarUrlForUser(userId, data.avatarUrl)) {
      throw new AppError("Invalid profile photo", "VALIDATION_ERROR", 400);
    }
    if (user.avatarUrl && user.avatarUrl !== data.avatarUrl) {
      previousAvatarUrl = user.avatarUrl;
    }
    user.avatarUrl = data.avatarUrl;
  }

  await user.save();
  await deleteReplacedNurseAvatar(previousAvatarUrl);

  if (data.bio !== undefined) {
    staff.bio = data.bio || undefined;
  }

  if (data.languages !== undefined) {
    staff.languages = data.languages;
  }

  if (data.isAvailable !== undefined) {
    staff.isAvailable = data.isAvailable;
  }

  if (data.specialties !== undefined) {
    staff.specialties = data.specialties;
  }

  if (
    data.city !== undefined ||
    data.area !== undefined ||
    data.radiusKm !== undefined ||
    data.geo !== undefined ||
    data.homeVisitEnabled !== undefined
  ) {
    const area = staff.serviceAreas?.[0];
    const existingGeo = area?.geo?.coordinates?.length === 2
      ? { type: "Point" as const, coordinates: area.geo.coordinates }
      : { type: "Point" as const, coordinates: [LAHORE_GEO.lng, LAHORE_GEO.lat] };

    const nextGeo = data.geo
      ? {
          type: "Point" as const,
          coordinates: [data.geo.lng, data.geo.lat] as [number, number],
        }
      : existingGeo;

    staff.serviceAreas = [
      {
        city: data.city ?? area?.city ?? LAUNCH_CITY,
        area: data.area ?? area?.area,
        geo: nextGeo,
        radiusKm: data.radiusKm ?? area?.radiusKm ?? 15,
      },
    ] as typeof staff.serviceAreas;
  }

  if (data.homeVisitEnabled !== undefined) {
    staff.homeVisitEnabled = data.homeVisitEnabled;
  }

  if (data.homeVisitFee !== undefined) {
    staff.homeVisitFee = data.homeVisitFee;
  }

  await staff.save();
  const displayName = safeDisplayText(user.name);
  if (displayName) {
    await ensureCanonicalNurseSlug(staff._id.toString(), displayName, staff.slug);
  }

  return getNurseProfile(userId);
}

/** Saves the sections present in `input` (each editor card saves independently). */
export async function updateNursePortfolio(
  userId: string,
  input: UpdateNursePortfolioInput,
): Promise<NursePortfolio> {
  const user = await loadNurseUser(userId);
  const staff = await ensureStaffProfile(user);

  const current = staff.portfolio ?? {};
  const next: Record<string, unknown> = {
    headline: current.headline,
    conditionsTreated: current.conditionsTreated,
    techniques: current.techniques,
    memberships: current.memberships,
    education: current.education,
    experience: current.experience,
    certifications: current.certifications,
    awards: current.awards,
  };

  if (input.headline !== undefined) next.headline = input.headline || undefined;
  for (const key of [
    "conditionsTreated",
    "techniques",
    "memberships",
    "education",
    "experience",
    "certifications",
    "awards",
  ] as const) {
    if (input[key] !== undefined) next[key] = input[key];
  }
  next.updatedAt = new Date();

  staff.set("portfolio", next);
  if (input.bio !== undefined) staff.bio = input.bio || undefined;
  if (input.languages !== undefined) staff.languages = input.languages;

  await staff.save();
  return mapNursePortfolio(staff);
}

export async function getNurseDashboardSummary(
  userId: string,
): Promise<NurseDashboardSummary> {
  const user = await loadNurseUser(userId);
  const staff = await ensureStaffProfile(user);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const baseFilter = {
    assignedStaffId: userId,
    deletedAt: { $exists: false },
  };

  const [activeVisits, upcomingToday, completedTotal, completedThisMonth, completedVisits] =
    await Promise.all([
      HomeVisitModel.countDocuments(
        mongoFilter({ ...baseFilter, status: { $in: ACTIVE_VISIT_STATUSES } }),
      ),
      HomeVisitModel.countDocuments(
        mongoFilter({
          ...baseFilter,
          status: { $in: ACTIVE_VISIT_STATUSES },
          scheduledAt: { $gte: startOfToday, $lt: endOfToday },
        }),
      ),
      HomeVisitModel.countDocuments(
        mongoFilter({ ...baseFilter, status: HomeVisitStatuses.COMPLETED }),
      ),
      HomeVisitModel.countDocuments(
        mongoFilter({
          ...baseFilter,
          status: HomeVisitStatuses.COMPLETED,
          completedAt: { $gte: startOfMonth },
        }),
      ),
      HomeVisitModel.find(
        mongoFilter({ ...baseFilter, status: HomeVisitStatuses.COMPLETED }),
      )
        .select("pricing.total completedAt")
        .lean(),
    ]);

  let earningsTotal = 0;
  let earningsThisMonth = 0;
  for (const visit of completedVisits) {
    const net = calculateNurseVisitEarnings(
      visit.pricing?.total ?? 0,
      staff.commissionPercent,
    );
    earningsTotal += net;
    if (visit.completedAt && visit.completedAt >= startOfMonth) earningsThisMonth += net;
  }

  return {
    activeVisits,
    upcomingToday,
    completedTotal,
    completedThisMonth,
    earningsTotal,
    earningsThisMonth,
    isAvailable: staff.isAvailable ?? true,
  };
}

/** Nurse submits credentials for admin review (mirrors physiotherapist verification). */
export async function submitNurseVerification(
  userId: string,
  input: NurseVerificationInput,
): Promise<NurseProfileDto> {
  const user = await loadNurseUser(userId);
  const staff = await ensureStaffProfile(user);

  if (staff.verificationStatus === VerificationStatuses.APPROVED) {
    throw new AppError("Already verified", "CONFLICT", 409);
  }

  if (!isNurseAvatarUrlForUser(userId, input.avatarUrl)) {
    throw new AppError("Invalid profile photo", "VALIDATION_ERROR", 400);
  }
  const previousAvatarUrl =
    user.avatarUrl && user.avatarUrl !== input.avatarUrl ? user.avatarUrl : undefined;
  user.avatarUrl = input.avatarUrl;

  staff.licenseNumber = input.licenseNumber;
  staff.cnicHash = hashCnic(input.cnic);
  staff.cnicLast4 = cnicLast4(input.cnic);
  staff.qualification = input.qualification;
  staff.experienceYears = input.experienceYears;
  staff.homeVisitFee = input.homeVisitFee;
  staff.specialties = input.specialties;
  const previousDocuments = staff.verificationDocuments
    ? { ...staff.verificationDocuments }
    : undefined;
  staff.verificationDocuments = input.documentUrls;
  staff.verificationSubmittedAt = new Date();
  staff.platformAgreementAcceptedAt = new Date();
  staff.platformAgreementVersion = PROVIDER_AGREEMENT_VERSION;
  staff.verificationStatus = VerificationStatuses.PENDING;
  staff.rejectionReason = undefined;
  staff.bankAccount = {
    accountTitle: input.bankAccount.accountTitle,
    bankName: input.bankAccount.bankName,
    accountNumber: input.bankAccount.accountNumber,
    iban: input.bankAccount.iban,
  };

  const { serviceArea } = input;
  staff.homeVisitEnabled = serviceArea.homeVisitEnabled;
  staff.serviceAreas = [
    {
      city: serviceArea.city,
      area: serviceArea.area,
      geo: serviceArea.geo
        ? {
            type: "Point" as const,
            coordinates: [serviceArea.geo.lng, serviceArea.geo.lat],
          }
        : undefined,
      radiusKm: 15,
    },
  ] as typeof staff.serviceAreas;

  if (serviceArea.city) {
    user.metadata = {
      ...user.metadata,
      locale: user.metadata?.locale ?? "en",
      city: serviceArea.city,
    };
  }
  await user.save();

  await staff.save();
  await deleteReplacedNurseDocuments(previousDocuments, input.documentUrls);
  await deleteReplacedNurseAvatar(previousAvatarUrl);

  return getNurseProfile(userId);
}

export type AdminNurseRow = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city: string;
  area?: string;
  licenseNumber?: string;
  qualification?: string;
  experienceYears?: number;
  specialties?: string[];
  cnicLast4?: string;
  verificationStatus: string;
  verificationSubmittedAt?: string;
  rejectionReason?: string;
  isAvailable: boolean;
  documents: { label: string; url: string }[];
  createdAt: string;
};

const DOCUMENT_LABELS: Record<string, string> = {
  licenseCertificate: "License / PNC certificate",
  cnicFront: "CNIC front",
  cnicBack: "CNIC back",
};

/** Admin: list Nurses, optionally filtered by verification status. */
export async function listNursesForAdmin(status?: string): Promise<AdminNurseRow[]> {
  await connectDatabase();

  const filter: Record<string, unknown> = {
    staffType: Roles.NURSE,
    deletedAt: { $exists: false },
  };
  if (status) filter.verificationStatus = status;

  const profiles = await StaffProfileModel.find(filter)
    .populate("userId", "name email phone metadata")
    .sort({ verificationSubmittedAt: -1, createdAt: -1 })
    .lean();

  return profiles
    .filter((p) => p.userId)
    .map((p) => {
      const user = p.userId as {
        _id?: { toString(): string };
        name?: string;
        email?: string;
        phone?: string;
        metadata?: { city?: string };
      };
      const docs = p.verificationDocuments ?? {};
      const documents = Object.entries(DOCUMENT_LABELS)
        .map(([key, label]) => ({
          label,
          url: (docs as Record<string, string | undefined>)[key] ?? "",
        }))
        .filter((d) => d.url);

      const pii = mapUserPii(user);

      return {
        id: p._id.toString(),
        name: pii.name,
        email: pii.email,
        phone: pii.phone,
        city: p.serviceAreas?.[0]?.city ?? user.metadata?.city ?? LAUNCH_CITY,
        area: p.serviceAreas?.[0]?.area ?? undefined,
        licenseNumber: p.licenseNumber ?? undefined,
        qualification: p.qualification ?? undefined,
        experienceYears: p.experienceYears ?? undefined,
        specialties: p.specialties ?? undefined,
        cnicLast4: p.cnicLast4 ?? undefined,
        verificationStatus: p.verificationStatus ?? VerificationStatuses.PENDING,
        verificationSubmittedAt: p.verificationSubmittedAt?.toISOString(),
        rejectionReason: p.rejectionReason ?? undefined,
        isAvailable: p.isAvailable ?? true,
        documents,
        createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    });
}

/** Admin approves or rejects a Nurse application. */
export async function decideNurseVerification(
  adminUserId: string,
  staffProfileId: string,
  action: "approve" | "reject",
  rejectionReason?: string,
) {
  await connectDatabase();

  const staff = await StaffProfileModel.findOne(
    mongoFilter({ _id: staffProfileId, staffType: Roles.NURSE }),
  );
  if (!staff) {
    throw new AppError("Nurse application not found", "NOT_FOUND", 404);
  }

  if (action === "approve") {
    staff.verificationStatus = VerificationStatuses.APPROVED;
    staff.verifiedBy = adminUserId as never;
    staff.verifiedAt = new Date();
    staff.rejectionReason = undefined;
    await UserModel.findByIdAndUpdate(staff.userId, {
      onboardingCompleted: true,
    });
  } else {
    staff.verificationStatus = VerificationStatuses.REJECTED;
    staff.rejectionReason = rejectionReason ?? "Application rejected";
  }

  await staff.save();

  if (action === "approve") {
    const approvedUser = await UserModel.findById(staff.userId).select("name").lean();
    const displayName = safeDisplayText(approvedUser?.name);
    if (displayName) {
      await ensureCanonicalNurseSlug(staff._id.toString(), displayName, staff.slug);
    }
  }

  await recordAdminActivity({
    actor: adminUserId,
    action:
      action === "approve"
        ? "nurse.verification_approved"
        : "nurse.verification_rejected",
    entityType: "StaffProfile",
    entityId: staffProfileId,
    changes: action === "approve" ? undefined : { rejectionReason: staff.rejectionReason },
  });

  return {
    id: staff._id.toString(),
    verificationStatus: staff.verificationStatus,
  };
}

export type { AdminNurseDetailDto, AdminNurseVisitRow } from "@/features/admin/types/nurse-admin";

function mapAdminNurseDocuments(
  docs: Record<string, string | undefined> | null | undefined,
) {
  return Object.entries(DOCUMENT_LABELS)
    .map(([key, label]) => ({
      label,
      url: docs?.[key] ?? "",
    }))
    .filter((d) => d.url);
}

/** Admin: full Nurse profile for application review. */
export async function getNurseProfileForAdmin(
  staffProfileId: string,
): Promise<AdminNurseDetailDto> {
  await connectDatabase();

  const staff = await StaffProfileModel.findOne(
    mongoFilter({ _id: staffProfileId, staffType: Roles.NURSE }),
  ).lean();
  if (!staff) {
    throw new AppError("Nurse application not found", "NOT_FOUND", 404);
  }

  const user = await UserModel.findById(staff.userId).lean();
  if (!user || user.deletedAt) {
    throw new AppError("User not found", "NOT_FOUND", 404);
  }

  const userId = user._id.toString();
  const area = staff.serviceAreas?.[0];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const baseFilter = {
    assignedStaffId: userId,
    deletedAt: { $exists: false },
  };

  const [activeVisits, completedTotal, completedThisMonth, visits, completedVisits] =
    await Promise.all([
      HomeVisitModel.countDocuments(
        mongoFilter({ ...baseFilter, status: { $in: ACTIVE_VISIT_STATUSES } }),
      ),
      HomeVisitModel.countDocuments(
        mongoFilter({ ...baseFilter, status: HomeVisitStatuses.COMPLETED }),
      ),
      HomeVisitModel.countDocuments(
        mongoFilter({
          ...baseFilter,
          status: HomeVisitStatuses.COMPLETED,
          completedAt: { $gte: startOfMonth },
        }),
      ),
      HomeVisitModel.find(mongoFilter(baseFilter))
        .populate("patientId", "name phone")
        .sort({ scheduledAt: -1 })
        .limit(50)
        .lean(),
      HomeVisitModel.find(
        mongoFilter({ ...baseFilter, status: HomeVisitStatuses.COMPLETED }),
      )
        .select("pricing completedAt")
        .lean(),
    ]);

  let totalEarnings = 0;
  let earningsThisMonth = 0;
  const commissionPercent = await getNurseCommissionPercentByUserId(userId);
  for (const visit of completedVisits) {
    const gross = visit.pricing?.total ?? 0;
    const total = calculateNurseVisitEarnings(gross, staff.commissionPercent);
    totalEarnings += total;
    if (visit.completedAt && visit.completedAt >= startOfMonth) {
      earningsThisMonth += total;
    }
  }

  const visitHistory: AdminNurseVisitRow[] = visits.map((visit) => {
    const patient = visit.patientId as
      | { _id?: { toString(): string }; name?: string; phone?: string }
      | null;
    return {
      id: visit._id.toString(),
      serviceType: visit.serviceType,
      status: visit.status,
      scheduledAt: visit.scheduledAt.toISOString(),
      completedAt: visit.completedAt?.toISOString(),
      address: {
        line: safeDisplayText(visit.address?.line) ?? "",
        city: safeDisplayText(visit.address?.city) ?? LAUNCH_CITY,
      },
      patient: {
        id: patient?._id?.toString() ?? "",
        name: safeDisplayText(patient?.name) ?? "Patient",
        phone: formatPhoneForDisplay(patient?.phone),
      },
      pricing: {
        total: visit.pricing?.total ?? 0,
        currency: visit.pricing?.currency ?? "PKR",
      },
    };
  });

  const pii = mapUserPii(user);

  return {
    id: staff._id.toString(),
    userId,
    user: {
      id: userId,
      name: pii.name,
      email: pii.email,
      phone: pii.phone,
      city: area?.city ?? user.metadata?.city ?? LAUNCH_CITY,
      memberSince: user.createdAt?.toISOString() ?? new Date().toISOString(),
      avatarUrl: user.avatarUrl ?? undefined,
      isActive: user.isActive !== false,
    },
    slug: staff.slug ?? undefined,
    bio: staff.bio ?? undefined,
    languages: staff.languages ?? [],
    portfolio: mapNursePortfolio(staff),
    commissionPercent,
    commissionOverride: staff.commissionPercent ?? null,
    verificationStatus: staff.verificationStatus ?? VerificationStatuses.PENDING,
    verificationSubmittedAt: staff.verificationSubmittedAt?.toISOString(),
    platformAgreementAcceptedAt: staff.platformAgreementAcceptedAt?.toISOString(),
    verifiedAt: staff.verifiedAt?.toISOString(),
    rejectionReason: staff.rejectionReason ?? undefined,
    adminNotes: staff.adminNotes ?? undefined,
    licenseNumber: staff.licenseNumber ?? undefined,
    qualification: staff.qualification ?? undefined,
    experienceYears: staff.experienceYears ?? undefined,
    specialties: staff.specialties ?? undefined,
    cnicLast4: staff.cnicLast4 ?? undefined,
    isAvailable: staff.isAvailable ?? true,
    homeVisitEnabled: staff.homeVisitEnabled ?? false,
    employeeCode: staff.employeeCode ?? undefined,
    serviceArea: {
      city: area?.city ?? LAUNCH_CITY,
      area: area?.area ?? undefined,
      radiusKm: area?.radiusKm ?? 15,
    },
    documents: mapAdminNurseDocuments(
      staff.verificationDocuments as Record<string, string | undefined>,
    ),
    stats: {
      activeVisits,
      completedTotal,
      completedThisMonth,
      totalEarnings,
      earningsThisMonth,
    },
    visitHistory,
  };
}

/** Admin: save private interview / review notes for a Nurse. */
export async function updateNurseAdminNotes(
  staffProfileId: string,
  notes: string,
): Promise<{ adminNotes: string }> {
  await connectDatabase();

  const staff = await StaffProfileModel.findOne(
    mongoFilter({ _id: staffProfileId, staffType: Roles.NURSE }),
  );
  if (!staff) {
    throw new AppError("Nurse application not found", "NOT_FOUND", 404);
  }

  staff.adminNotes = notes.trim() || undefined;
  await staff.save();

  return { adminNotes: staff.adminNotes ?? "" };
}

export async function getNurseAgreementStatus(userId: string): Promise<{
  accepted: boolean;
  acceptedAt?: string;
  version?: string;
  currentVersion: string;
}> {
  await connectDatabase();
  const staff = await StaffProfileModel.findOne(
    mongoFilter({ userId, staffType: Roles.NURSE }),
  )
    .select("platformAgreementAcceptedAt platformAgreementVersion")
    .lean();
  if (!staff) throw new AppError("Nurse profile not found", "NOT_FOUND", 404);

  return {
    accepted: Boolean(staff.platformAgreementAcceptedAt),
    acceptedAt: staff.platformAgreementAcceptedAt?.toISOString(),
    version: staff.platformAgreementVersion ?? undefined,
    currentVersion: PROVIDER_AGREEMENT_VERSION,
  };
}

/** Retroactive acceptance for nurses approved before the Provider Agreement existed. */
export async function acceptNurseAgreement(userId: string): Promise<void> {
  await connectDatabase();
  const staff = await StaffProfileModel.findOne(
    mongoFilter({ userId, staffType: Roles.NURSE }),
  );
  if (!staff) throw new AppError("Nurse profile not found", "NOT_FOUND", 404);

  staff.platformAgreementAcceptedAt = new Date();
  staff.platformAgreementVersion = PROVIDER_AGREEMENT_VERSION;
  await staff.save();
}
