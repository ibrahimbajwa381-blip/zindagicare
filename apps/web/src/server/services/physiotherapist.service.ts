import {
  connectDatabase,
  HomeVisitModel,
  StaffProfileModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  HomeVisitStatuses,
  LAHORE_GEO,
  LAUNCH_CITY,
  Roles,
  VerificationStatuses,
  phoneLookupHash,
} from "@zindagi/shared";
import {
  normalizePhoneDigits,
  toPakistaniLocalPhone,
  type PhysiotherapistVerificationInput,
  type UpdatePhysiotherapistProfileInput,
} from "@zindagi/validators";
import { normalizePakistaniPhone } from "@/lib/auth/phone";
import { mongoFilter } from "@/lib/mongo/query";
import { formatPhoneForDisplay, mapUserPii, safeDisplayText } from "@/server/lib/decrypt-pii";
import type {
  AdminPhysiotherapistDetailDto,
  AdminPhysiotherapistVisitRow,
} from "@/features/admin/types/physiotherapist-admin";
import { cnicLast4, hashCnic } from "./auth.service";
import {
  calculateStaffNetEarnings,
  getPhysiotherapistCommissionPercentByUserId,
} from "./commission.service";

const ACTIVE_VISIT_STATUSES = [
  HomeVisitStatuses.ASSIGNED,
  HomeVisitStatuses.EN_ROUTE,
  HomeVisitStatuses.ARRIVED,
];

export type PhysiotherapistProfileDto = {
  user: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    city: string;
    memberSince: string;
  };
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
  };
  verification: {
    status: string;
    submittedAt?: string;
    rejectionReason?: string;
    licenseNumber?: string;
    qualification?: string;
    experienceYears?: number;
    cnicLast4?: string;
  };
};

export type PhysiotherapistDashboardSummary = {
  activeVisits: number;
  upcomingToday: number;
  completedTotal: number;
  completedThisMonth: number;
  isAvailable: boolean;
};

async function loadPhysiotherapistUser(userId: string) {
  await connectDatabase();
  const user = await UserModel.findById(userId);
  if (!user || user.deletedAt || user.isActive === false) {
    throw new AppError("User not found", "NOT_FOUND", 404);
  }
  if (!user.roles?.includes(Roles.PHYSIOTHERAPIST)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  return user;
}

type PhysiotherapistUserDoc = Awaited<ReturnType<typeof loadPhysiotherapistUser>>;

/** Ensure a StaffProfile exists for the Physiotherapist (covers legacy/seeded accounts). */
async function ensureStaffProfile(user: PhysiotherapistUserDoc) {
  const existing = await StaffProfileModel.findOne(
    mongoFilter({ userId: user._id, staffType: Roles.PHYSIOTHERAPIST }),
  );
  if (existing) return existing;

  return StaffProfileModel.create({
    userId: user._id.toString(),
    staffType: Roles.PHYSIOTHERAPIST,
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

export async function getPhysiotherapistProfile(userId: string): Promise<PhysiotherapistProfileDto> {
  const user = await loadPhysiotherapistUser(userId);
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
    },
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
    },
    verification: {
      status: staff.verificationStatus ?? VerificationStatuses.PENDING,
      submittedAt: staff.verificationSubmittedAt?.toISOString(),
      rejectionReason: staff.rejectionReason ?? undefined,
      licenseNumber: staff.licenseNumber ?? undefined,
      qualification: staff.qualification ?? undefined,
      experienceYears: staff.experienceYears ?? undefined,
      cnicLast4: staff.cnicLast4 ?? undefined,
    },
  };
}

export async function updatePhysiotherapistProfile(
  userId: string,
  data: UpdatePhysiotherapistProfileInput,
): Promise<PhysiotherapistProfileDto> {
  const user = await loadPhysiotherapistUser(userId);
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

  await user.save();

  if (data.isAvailable !== undefined) {
    staff.isAvailable = data.isAvailable;
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

  await staff.save();

  return getPhysiotherapistProfile(userId);
}

export async function getPhysiotherapistDashboardSummary(
  userId: string,
): Promise<PhysiotherapistDashboardSummary> {
  const user = await loadPhysiotherapistUser(userId);
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

  const [activeVisits, upcomingToday, completedTotal, completedThisMonth] =
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
    ]);

  return {
    activeVisits,
    upcomingToday,
    completedTotal,
    completedThisMonth,
    isAvailable: staff.isAvailable ?? true,
  };
}

/** Physiotherapist submits credentials for admin review (mirrors doctor verification). */
export async function submitPhysiotherapistVerification(
  userId: string,
  input: PhysiotherapistVerificationInput,
): Promise<PhysiotherapistProfileDto> {
  const user = await loadPhysiotherapistUser(userId);
  const staff = await ensureStaffProfile(user);

  if (staff.verificationStatus === VerificationStatuses.APPROVED) {
    throw new AppError("Already verified", "CONFLICT", 409);
  }

  staff.licenseNumber = input.licenseNumber;
  staff.cnicHash = hashCnic(input.cnic);
  staff.cnicLast4 = cnicLast4(input.cnic);
  staff.qualification = input.qualification;
  staff.experienceYears = input.experienceYears;
  staff.verificationDocuments = input.documentUrls;
  staff.verificationSubmittedAt = new Date();
  staff.verificationStatus = VerificationStatuses.PENDING;
  staff.rejectionReason = undefined;

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
    await user.save();
  }

  await staff.save();

  return getPhysiotherapistProfile(userId);
}

export type AdminPhysiotherapistRow = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city: string;
  area?: string;
  licenseNumber?: string;
  qualification?: string;
  experienceYears?: number;
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

/** Admin: list Physiotherapists, optionally filtered by verification status. */
export async function listPhysiotherapistsForAdmin(status?: string): Promise<AdminPhysiotherapistRow[]> {
  await connectDatabase();

  const filter: Record<string, unknown> = {
    staffType: Roles.PHYSIOTHERAPIST,
    deletedAt: { $exists: false },
  };
  if (status) filter.verificationStatus = status;

  const profiles = await StaffProfileModel.find(filter)
    .populate("userId", "name email phone metadata")
    .sort({ verificationSubmittedAt: 1, createdAt: 1 })
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

/** Admin approves or rejects a Physiotherapist application. */
export async function decidePhysiotherapistVerification(
  adminUserId: string,
  staffProfileId: string,
  action: "approve" | "reject",
  rejectionReason?: string,
) {
  await connectDatabase();

  const staff = await StaffProfileModel.findOne(
    mongoFilter({ _id: staffProfileId, staffType: Roles.PHYSIOTHERAPIST }),
  );
  if (!staff) {
    throw new AppError("Physiotherapist application not found", "NOT_FOUND", 404);
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

  return {
    id: staff._id.toString(),
    verificationStatus: staff.verificationStatus,
  };
}

export type { AdminPhysiotherapistDetailDto, AdminPhysiotherapistVisitRow } from "@/features/admin/types/physiotherapist-admin";

function mapAdminPhysiotherapistDocuments(
  docs: Record<string, string | undefined> | null | undefined,
) {
  return Object.entries(DOCUMENT_LABELS)
    .map(([key, label]) => ({
      label,
      url: docs?.[key] ?? "",
    }))
    .filter((d) => d.url);
}

/** Admin: full Physiotherapist profile for application review. */
export async function getPhysiotherapistProfileForAdmin(
  staffProfileId: string,
): Promise<AdminPhysiotherapistDetailDto> {
  await connectDatabase();

  const staff = await StaffProfileModel.findOne(
    mongoFilter({ _id: staffProfileId, staffType: Roles.PHYSIOTHERAPIST }),
  ).lean();
  if (!staff) {
    throw new AppError("Physiotherapist application not found", "NOT_FOUND", 404);
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
  const commissionPercent = await getPhysiotherapistCommissionPercentByUserId(userId);
  for (const visit of completedVisits) {
    const gross = visit.pricing?.total ?? 0;
    const total = calculateStaffNetEarnings(gross, commissionPercent);
    totalEarnings += total;
    if (visit.completedAt && visit.completedAt >= startOfMonth) {
      earningsThisMonth += total;
    }
  }

  const visitHistory: AdminPhysiotherapistVisitRow[] = visits.map((visit) => {
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
    },
    verificationStatus: staff.verificationStatus ?? VerificationStatuses.PENDING,
    verificationSubmittedAt: staff.verificationSubmittedAt?.toISOString(),
    verifiedAt: staff.verifiedAt?.toISOString(),
    rejectionReason: staff.rejectionReason ?? undefined,
    adminNotes: staff.adminNotes ?? undefined,
    licenseNumber: staff.licenseNumber ?? undefined,
    qualification: staff.qualification ?? undefined,
    experienceYears: staff.experienceYears ?? undefined,
    cnicLast4: staff.cnicLast4 ?? undefined,
    isAvailable: staff.isAvailable ?? true,
    homeVisitEnabled: staff.homeVisitEnabled ?? false,
    employeeCode: staff.employeeCode ?? undefined,
    serviceArea: {
      city: area?.city ?? LAUNCH_CITY,
      area: area?.area ?? undefined,
      radiusKm: area?.radiusKm ?? 15,
    },
    documents: mapAdminPhysiotherapistDocuments(
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

/** Admin: save private interview / review notes for a Physiotherapist. */
export async function updatePhysiotherapistAdminNotes(
  staffProfileId: string,
  notes: string,
): Promise<{ adminNotes: string }> {
  await connectDatabase();

  const staff = await StaffProfileModel.findOne(
    mongoFilter({ _id: staffProfileId, staffType: Roles.PHYSIOTHERAPIST }),
  );
  if (!staff) {
    throw new AppError("Physiotherapist application not found", "NOT_FOUND", 404);
  }

  staff.adminNotes = notes.trim() || undefined;
  await staff.save();

  return { adminNotes: staff.adminNotes ?? "" };
}
