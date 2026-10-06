import bcrypt from "bcryptjs";
import { isValidObjectId } from "mongoose";
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
  calculateNurseVisitEarnings,
  emailLookupHash,
  phoneLookupHash,
} from "@zindagi/shared";
import {
  normalizePhoneDigits,
  toPakistaniLocalPhone,
  type AdminCreateNurseInput,
  type AdminUpdateNurseInput,
} from "@zindagi/validators";
import { normalizePakistaniPhone } from "@/lib/auth/phone";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { mapUserPii, safeDisplayText } from "@/server/lib/decrypt-pii";
import type {
  AdminNurseManageRow,
  AdminNurseManageStats,
} from "@/features/admin/types/nurse-admin";
import { recordAdminActivity } from "./admin-activity.service";
import { resolveCommissionPercent } from "./commission.service";
import { decideNurseVerification } from "./nurse.service";
import { ensureCanonicalNurseSlug } from "./nurse-slug.service";
import {
  deleteNurseAvatar,
  nurseAvatarStorageKeyFromUrl,
} from "./nurse-avatar.storage";
import {
  deleteNurseDocument,
  nurseDocumentStorageKeyFromUrl,
} from "./nurse-documents.storage";
import { getSystemSettings } from "./system-settings.service";

export type { AdminNurseManageRow } from "@/features/admin/types/nurse-admin";

const BCRYPT_ROUNDS = 12;
const DEFAULT_PASSWORD = "Nurse@123";

const ACTIVE_VISIT_STATUSES: string[] = [
  HomeVisitStatuses.ASSIGNED,
  HomeVisitStatuses.EN_ROUTE,
  HomeVisitStatuses.ARRIVED,
];

const EMPTY_STATS: AdminNurseManageStats = {
  activeVisits: 0,
  upcomingToday: 0,
  completedTotal: 0,
  completedThisMonth: 0,
  totalEarnings: 0,
  earningsThisMonth: 0,
};

type LeanUser = {
  _id: { toString(): string };
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  isActive?: boolean;
  deletedAt?: Date;
  metadata?: { city?: string };
  createdAt?: Date;
};

async function findNurseStaff(staffProfileId: string) {
  if (!isValidObjectId(staffProfileId)) {
    throw new AppError("Nurse not found", "NOT_FOUND", 404);
  }
  const staff = await StaffProfileModel.findOne(
    mongoFilter({
      _id: staffProfileId,
      staffType: Roles.NURSE,
      deletedAt: { $exists: false },
    }),
  );
  if (!staff) throw new AppError("Nurse not found", "NOT_FOUND", 404);
  return staff;
}

/** Visit counts + net earnings per nurse user id. */
async function loadStatsBatch(
  userIds: string[],
  commissionOverrideByUserId: Map<string, number | null>,
): Promise<Map<string, AdminNurseManageStats>> {
  const statsMap = new Map<string, AdminNurseManageStats>();
  for (const id of userIds) statsMap.set(id, { ...EMPTY_STATS });
  if (!userIds.length) return statsMap;

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const visits = await HomeVisitModel.find(
    mongoFilter({
      assignedStaffId: { $in: mongoObjectIds(userIds) },
      deletedAt: { $exists: false },
      status: { $in: [...ACTIVE_VISIT_STATUSES, HomeVisitStatuses.COMPLETED] },
    }),
  )
    .select("assignedStaffId status scheduledAt completedAt pricing.total")
    .lean();

  for (const visit of visits) {
    const userId = visit.assignedStaffId?.toString();
    const stats = userId ? statsMap.get(userId) : undefined;
    if (!userId || !stats) continue;

    if (ACTIVE_VISIT_STATUSES.includes(visit.status)) {
      stats.activeVisits += 1;
      if (visit.scheduledAt >= startOfToday && visit.scheduledAt < endOfToday) {
        stats.upcomingToday += 1;
      }
      continue;
    }

    // Completed — per-visit net, matching the detail page and payouts.
    const net = calculateNurseVisitEarnings(
      visit.pricing?.total ?? 0,
      commissionOverrideByUserId.get(userId),
    );
    stats.completedTotal += 1;
    stats.totalEarnings += net;
    if (visit.completedAt && visit.completedAt >= startOfMonth) {
      stats.completedThisMonth += 1;
      stats.earningsThisMonth += net;
    }
  }

  return statsMap;
}

async function buildRows(
  profiles: Array<{
    _id: { toString(): string };
    userId?: unknown;
    serviceAreas?: Array<{ city?: string | null; area?: string | null }> | null;
    slug?: string | null;
    licenseNumber?: string | null;
    qualification?: string | null;
    experienceYears?: number | null;
    specialties?: string[] | null;
    verificationStatus?: string | null;
    rejectionReason?: string | null;
    isAvailable?: boolean | null;
    homeVisitEnabled?: boolean | null;
    commissionPercent?: number | null;
    createdAt?: Date | null;
  }>,
): Promise<AdminNurseManageRow[]> {
  const userIds = profiles
    .map((p) => (p.userId ? String(p.userId) : ""))
    .filter(Boolean);
  if (!userIds.length) return [];

  const [users, settings] = await Promise.all([
    UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(userIds) } }))
      .select("name email phone avatarUrl isActive deletedAt metadata")
      .lean<LeanUser[]>(),
    getSystemSettings(),
  ]);
  const userMap = new Map(
    users.filter((u) => !u.deletedAt).map((u) => [u._id.toString(), u]),
  );

  const commissionByUserId = new Map<string, number>();
  const commissionOverrideByUserId = new Map<string, number | null>();
  for (const p of profiles) {
    commissionOverrideByUserId.set(String(p.userId), p.commissionPercent ?? null);
    commissionByUserId.set(
      String(p.userId),
      resolveCommissionPercent(
        p.commissionPercent,
        settings.defaultNurseCommissionPercent,
      ),
    );
  }
  const statsMap = await loadStatsBatch([...userMap.keys()], commissionOverrideByUserId);

  const rows: AdminNurseManageRow[] = [];
  for (const p of profiles) {
    const userId = String(p.userId);
    const user = userMap.get(userId);
    if (!user) continue; // orphaned or deleted account
    const pii = mapUserPii(user);
    const area = p.serviceAreas?.[0];
    rows.push({
      id: p._id.toString(),
      userId,
      name: pii.name,
      email: pii.email,
      phone: pii.phone,
      avatarUrl: user.avatarUrl ?? undefined,
      slug: p.slug ?? undefined,
      city: area?.city ?? user.metadata?.city ?? LAUNCH_CITY,
      area: area?.area ?? undefined,
      licenseNumber: p.licenseNumber ?? undefined,
      qualification: p.qualification ?? undefined,
      experienceYears: p.experienceYears ?? undefined,
      specialties: p.specialties ?? [],
      verificationStatus: p.verificationStatus ?? VerificationStatuses.PENDING,
      rejectionReason: p.rejectionReason ?? undefined,
      isActive: user.isActive !== false,
      isAvailable: p.isAvailable !== false,
      homeVisitEnabled: Boolean(p.homeVisitEnabled),
      commissionPercent: commissionByUserId.get(userId) ?? 0,
      commissionOverride: p.commissionPercent ?? null,
      stats: statsMap.get(userId) ?? { ...EMPTY_STATS },
      createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
    });
  }
  return rows;
}

async function buildRow(staffProfileId: string): Promise<AdminNurseManageRow> {
  const staff = await StaffProfileModel.findById(staffProfileId).lean();
  if (!staff) throw new AppError("Nurse not found", "NOT_FOUND", 404);
  const [row] = await buildRows([staff]);
  if (!row) throw new AppError("Nurse not found", "NOT_FOUND", 404);
  return row;
}

/**
 * Admin: nurse directory. Pending applications live in the
 * verification queue, so (like doctor management) only decided profiles show here.
 */
export async function listNursesForManagement(
  search?: string,
): Promise<AdminNurseManageRow[]> {
  await connectDatabase();

  const profiles = await StaffProfileModel.find(
    mongoFilter({
      staffType: Roles.NURSE,
      deletedAt: { $exists: false },
      verificationStatus: { $ne: VerificationStatuses.PENDING },
    }),
  )
    .sort({ createdAt: -1 })
    .lean();

  const rows = await buildRows(profiles);

  // name/email/phone are encrypted at rest, so filter after decryption.
  const q = search?.trim().toLowerCase();
  if (!q) return rows;
  const qDigits = normalizePhoneDigits(q);
  return rows.filter(
    (r) =>
      [r.name, r.email, r.licenseNumber, r.city, r.area].some((v) =>
        v?.toLowerCase().includes(q),
      ) ||
      (qDigits.length >= 3 && Boolean(r.phone && normalizePhoneDigits(r.phone).includes(qDigits))),
  );
}

async function assertPhoneAvailable(phoneInput: string, excludeUserId?: string) {
  const normalized = normalizePakistaniPhone(phoneInput);
  const phoneLocal = toPakistaniLocalPhone(normalizePhoneDigits(phoneInput));
  const existing = await UserModel.findOne(
    mongoFilter({
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
      $or: [
        { phoneLookup: phoneLookupHash(normalized) },
        { phoneLookup: phoneLookupHash(phoneLocal) },
      ],
    }),
  );
  if (existing) {
    throw new AppError("Phone number already in use", "CONFLICT", 409, "phone");
  }
  return normalized;
}

/** Admin: create a verified nurse account directly. */
export async function adminCreateNurse(
  adminUserId: string,
  input: AdminCreateNurseInput,
): Promise<AdminNurseManageRow> {
  await connectDatabase();
  const email = input.email.toLowerCase();

  const existing = await UserModel.findOne({ emailLookup: emailLookupHash(email) });
  if (existing) {
    throw new AppError("Email already in use", "CONFLICT", 409, "email");
  }
  const phone = input.phone ? await assertPhoneAvailable(input.phone) : undefined;

  const passwordHash = await bcrypt.hash(input.password ?? DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  const name = input.name.trim();
  const city = input.city.trim();

  const user = await UserModel.create({
    name,
    email,
    ...(phone ? { phone } : {}),
    passwordHash,
    roles: [Roles.NURSE],
    authProviders: ["credentials"],
    emailVerified: new Date(),
    onboardingCompleted: true,
    isActive: true,
    metadata: { city, locale: "en" as const },
  });

  let staffId: string;
  try {
    const staff = await StaffProfileModel.create({
      userId: user._id,
      staffType: Roles.NURSE,
      isAvailable: true,
      homeVisitEnabled: input.homeVisitEnabled ?? true,
      verificationStatus: VerificationStatuses.APPROVED,
      verifiedBy: adminUserId,
      verifiedAt: new Date(),
      licenseNumber: input.licenseNumber.trim(),
      qualification: input.qualification?.trim() || undefined,
      experienceYears: input.experienceYears,
      specialties: input.specialties,
      languages: ["English", "Urdu"],
      serviceAreas: [
        {
          city,
          area: input.area?.trim() || undefined,
          geo: { type: "Point", coordinates: [LAHORE_GEO.lng, LAHORE_GEO.lat] },
          radiusKm: 15,
        },
      ],
      adminNotes: `Added manually by admin ${adminUserId}.`,
    });
    staffId = staff._id.toString();
    await ensureCanonicalNurseSlug(staffId, name, undefined);
  } catch (error) {
    await StaffProfileModel.deleteOne(mongoFilter({ userId: user._id }));
    await UserModel.deleteOne({ _id: user._id });
    throw error;
  }

  await recordAdminActivity({
    actor: adminUserId,
    action: "nurse.created",
    entityType: "StaffProfile",
    entityId: staffId,
    targetLabel: name,
  });

  return buildRow(staffId);
}

/** Admin: update status, service toggles, commission, and profile details. */
export async function adminUpdateNurse(
  adminUserId: string,
  staffProfileId: string,
  input: AdminUpdateNurseInput,
): Promise<AdminNurseManageRow> {
  await connectDatabase();
  const current = await findNurseStaff(staffProfileId);

  const user = await UserModel.findById(current.userId);
  if (!user || user.deletedAt) {
    throw new AppError("Nurse account not found", "NOT_FOUND", 404);
  }

  if (
    input.verificationStatus === VerificationStatuses.APPROVED &&
    current.verificationStatus !== VerificationStatuses.APPROVED
  ) {
    await decideNurseVerification(adminUserId, staffProfileId, "approve");
  } else if (input.verificationStatus === VerificationStatuses.REJECTED) {
    await decideNurseVerification(
      adminUserId,
      staffProfileId,
      "reject",
      input.rejectionReason,
    );
  }

  // Re-read: the verification decision saves the profile on its own.
  const staff = await findNurseStaff(staffProfileId);

  if (input.homeVisitEnabled && staff.verificationStatus !== VerificationStatuses.APPROVED) {
    throw new AppError(
      "Only approved nurses can take home visits",
      "VALIDATION_ERROR",
      400,
    );
  }

  // ── Account (User) ──
  let userChanged = false;
  if (input.isActive !== undefined) {
    user.isActive = input.isActive;
    userChanged = true;
  }
  if (input.name !== undefined) {
    user.name = input.name.trim();
    userChanged = true;
  }
  if (input.phone !== undefined) {
    const normalized = normalizePakistaniPhone(input.phone);
    const phoneLocal = toPakistaniLocalPhone(normalizePhoneDigits(input.phone));
    const currentPhone = safeDisplayText(user.phone);
    if (normalized !== currentPhone && phoneLocal !== currentPhone) {
      user.phone = await assertPhoneAvailable(input.phone, user._id.toString());
      userChanged = true;
    }
  }
  if (input.city !== undefined) {
    user.metadata = {
      ...user.metadata,
      locale: user.metadata?.locale ?? "en",
      city: input.city.trim(),
    };
    userChanged = true;
  }

  // ── Staff profile ──
  if (input.isAvailable !== undefined) staff.isAvailable = input.isAvailable;
  if (input.homeVisitEnabled !== undefined) staff.homeVisitEnabled = input.homeVisitEnabled;
  if (input.commissionPercent !== undefined) staff.commissionPercent = input.commissionPercent;
  if (input.bio !== undefined) staff.bio = input.bio || undefined;
  if (input.languages !== undefined) staff.languages = input.languages;
  if (input.specialties !== undefined) staff.specialties = input.specialties;
  if (input.licenseNumber !== undefined) staff.licenseNumber = input.licenseNumber.trim();
  if (input.qualification !== undefined) {
    staff.qualification = input.qualification.trim() || undefined;
  }
  if (input.experienceYears !== undefined) staff.experienceYears = input.experienceYears;

  if (input.city !== undefined || input.area !== undefined || input.radiusKm !== undefined) {
    const area = staff.serviceAreas?.[0];
    const geo =
      area?.geo?.coordinates?.length === 2
        ? { type: "Point" as const, coordinates: area.geo.coordinates }
        : { type: "Point" as const, coordinates: [LAHORE_GEO.lng, LAHORE_GEO.lat] };
    staff.serviceAreas = [
      {
        city: input.city?.trim() ?? area?.city ?? LAUNCH_CITY,
        area: input.area !== undefined ? input.area.trim() || undefined : area?.area,
        geo,
        radiusKm: input.radiusKm ?? area?.radiusKm ?? 15,
      },
    ] as typeof staff.serviceAreas;
  }

  if (userChanged) await user.save();
  await staff.save();

  if (input.name !== undefined) {
    const displayName = safeDisplayText(user.name);
    if (displayName) {
      await ensureCanonicalNurseSlug(staff._id.toString(), displayName, staff.slug);
    }
  }

  // Status changes are already audited by the verification decision.
  const changedFields = Object.keys(input).filter(
    (key) => key !== "verificationStatus" && key !== "rejectionReason",
  );
  if (changedFields.length) {
    await recordAdminActivity({
      actor: adminUserId,
      action: "nurse.updated",
      entityType: "StaffProfile",
      entityId: staffProfileId,
      targetLabel: safeDisplayText(user.name),
      changes: { fields: changedFields },
    });
  }

  return buildRow(staffProfileId);
}

/**
 * Admin: permanently delete a nurse. Blocked while they hold open
 * visits (assigned / en route / arrived, or requested with them as the patient's pick).
 */
export async function adminDeleteNurse(
  adminUserId: string,
  staffProfileId: string,
): Promise<void> {
  await connectDatabase();
  const staff = await findNurseStaff(staffProfileId);
  const userId = staff.userId.toString();

  const openVisits = await HomeVisitModel.countDocuments(
    mongoFilter({
      deletedAt: { $exists: false },
      $or: [
        { assignedStaffId: userId, status: { $in: ACTIVE_VISIT_STATUSES } },
        { preferredStaffId: userId, status: HomeVisitStatuses.REQUESTED },
      ],
    }),
  );
  if (openVisits > 0) {
    throw new AppError(
      "Cannot delete a nurse with open home visits. Reassign, complete, or cancel them first.",
      "VALIDATION_ERROR",
      400,
    );
  }

  const user = await UserModel.findById(userId);
  const displayName = safeDisplayText(user?.name);
  const otherRoles = (user?.roles ?? []).filter((r) => r !== Roles.NURSE);
  const deleteAccount = Boolean(user) && otherRoles.length === 0;
  // The avatar belongs to the account, so keep it when the account survives.
  const avatarKey =
    deleteAccount && user?.avatarUrl
      ? nurseAvatarStorageKeyFromUrl(user.avatarUrl)
      : null;
  const documentKeys = Object.values(
    (staff.verificationDocuments ?? {}) as Record<string, string | undefined>,
  )
    .filter((url): url is string => typeof url === "string" && Boolean(url))
    .map((url) => nurseDocumentStorageKeyFromUrl(url));

  await StaffProfileModel.deleteOne({ _id: staff._id });

  if (user) {
    if (deleteAccount) {
      await UserModel.deleteOne({ _id: user._id });
    } else {
      // Shared account (e.g. also a patient) — only strip the nurse role.
      user.roles = otherRoles;
      await user.save();
    }
  }

  // Best-effort file cleanup; a missing file must not fail the delete.
  if (avatarKey) {
    try {
      await deleteNurseAvatar(avatarKey);
    } catch {
      /* ignore */
    }
  }
  for (const key of documentKeys) {
    if (!key) continue;
    try {
      await deleteNurseDocument(key);
    } catch {
      /* ignore */
    }
  }

  await recordAdminActivity({
    actor: adminUserId,
    action: "nurse.deleted",
    entityType: "StaffProfile",
    entityId: staffProfileId,
    targetLabel: displayName,
  });
}
