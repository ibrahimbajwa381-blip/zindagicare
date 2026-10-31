import { connectDatabase, UserModel } from "@zindagi/database";
import {
  AppError,
  ADMIN_PANEL_ROLES,
  Roles,
  isAdmin,
  isManagerOnly,
  type Role,
  emailLookupHash,
} from "@zindagi/shared";
import type { z } from "zod";
import { normalizePhoneDigits, type adminGrantSchema } from "@zindagi/validators";
import { formatPhoneForDisplay, mapUserPii } from "@/server/lib/decrypt-pii";
import { recordAdminActivity } from "@/server/services/admin-activity.service";

type GrantInput = z.infer<typeof adminGrantSchema>;

export type AdminUserRow = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  roles: Role[];
  isSuperAdmin: boolean;
  /** Restricted operations manager (no admin role). */
  isManager: boolean;
  isActive: boolean;
  createdAt: string;
  grantedVia: "admin" | "super_admin";
};

export type AdminGrantCandidate = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  roles: Role[];
};

function mapAdminRow(user: {
  _id: { toString(): string };
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  roles?: Role[];
  isActive?: boolean;
  createdAt?: Date;
}): AdminUserRow {
  const pii = mapUserPii(user);
  const roles = (user.roles ?? []) as Role[];
  const isSuperAdmin = roles.includes(Roles.SUPER_ADMIN);

  return {
    id: user._id.toString(),
    name: pii.name,
    email: pii.email,
    phone: formatPhoneForDisplay(pii.phone),
    roles,
    isSuperAdmin,
    isManager: isManagerOnly(roles),
    isActive: user.isActive !== false,
    createdAt: user.createdAt?.toISOString() ?? new Date().toISOString(),
    grantedVia: isSuperAdmin ? "super_admin" : "admin",
  };
}

/**
 * name/email/phone are encrypted at rest, so substring matching can't happen
 * in the database — decrypt a bounded candidate set and filter in memory.
 */
function matchesUserSearch(
  user: { name?: string | null; email?: string | null; phone?: string | null },
  q: string,
): boolean {
  const needle = q.toLowerCase();
  const needleDigits = normalizePhoneDigits(q);
  const pii = mapUserPii(user);
  const phoneDigits = pii.phone ? normalizePhoneDigits(pii.phone) : "";
  return Boolean(
    pii.name?.toLowerCase().includes(needle) ||
      pii.email?.toLowerCase().includes(needle) ||
      (needleDigits.length >= 3 && phoneDigits.includes(needleDigits)),
  );
}

async function countActiveAdmins(): Promise<number> {
  return UserModel.countDocuments({
    roles: { $in: [Roles.ADMIN, Roles.SUPER_ADMIN] },
    deletedAt: null,
    isActive: { $ne: false },
  });
}

export async function listAdmins(search?: string): Promise<AdminUserRow[]> {
  await connectDatabase();
  const q = search?.trim();

  const users = await UserModel.find({
    roles: { $in: ADMIN_PANEL_ROLES },
    deletedAt: null,
  })
    .select("name email phone roles isActive createdAt")
    .sort({ createdAt: -1 })
    .limit(q ? 1000 : 100)
    .lean();

  const matched = q ? users.filter((user) => matchesUserSearch(user, q)) : users;
  return matched.slice(0, 100).map((user) => mapAdminRow(user));
}

export async function searchAdminGrantCandidates(
  search: string,
): Promise<AdminGrantCandidate[]> {
  await connectDatabase();
  const q = search.trim();
  if (q.length < 2) return [];

  const users = await UserModel.find({
    deletedAt: null,
    roles: { $nin: [Roles.ADMIN, Roles.SUPER_ADMIN] },
  })
    .select("name email phone roles")
    .sort({ createdAt: -1 })
    .limit(3000)
    .lean();

  const matched = users.filter((user) => matchesUserSearch(user, q)).slice(0, 20);

  return matched.map((user) => {
    const pii = mapUserPii(user);
    return {
      id: user._id.toString(),
      name: pii.name,
      email: pii.email,
      phone: formatPhoneForDisplay(pii.phone),
      roles: (user.roles ?? []) as Role[],
    };
  });
}

export async function grantAdminAccess(
  actorUserId: string,
  input: GrantInput,
): Promise<AdminUserRow> {
  await connectDatabase();

  const actor = await UserModel.findById(actorUserId).select("roles").lean();
  if (!actor || !isAdmin(actor.roles)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  let target = null;
  if (input.userId) {
    target = await UserModel.findById(input.userId);
  } else if (input.email) {
    const email = input.email.trim().toLowerCase();
    target = await UserModel.findOne({ emailLookup: emailLookupHash(email) });
  }

  if (!target || target.deletedAt) {
    throw new AppError("User not found", "NOT_FOUND", 404);
  }

  if (
    target.roles.includes(Roles.ADMIN) ||
    target.roles.includes(Roles.SUPER_ADMIN)
  ) {
    throw new AppError("User is already an admin", "CONFLICT", 409);
  }

  if (input.role === Roles.MANAGER) {
    if (target.roles.includes(Roles.MANAGER)) {
      throw new AppError("User is already a manager", "CONFLICT", 409);
    }
    target.roles = [...target.roles, Roles.MANAGER];
  } else {
    // Promoting a manager to admin replaces the restricted role.
    target.roles = [...target.roles.filter((r) => r !== Roles.MANAGER), Roles.ADMIN];
  }
  await target.save();

  await recordAdminActivity({
    actor: actorUserId,
    action: "admin.access_granted",
    entityType: "User",
    entityId: target._id.toString(),
    targetLabel: mapUserPii(target).name,
    changes: { role: input.role },
  });

  return mapAdminRow(target);
}

export async function revokeAdminAccess(
  actorUserId: string,
  targetUserId: string,
): Promise<{ revoked: true }> {
  await connectDatabase();

  if (actorUserId === targetUserId) {
    throw new AppError("You cannot remove your own admin access", "FORBIDDEN", 403);
  }

  const [actor, target] = await Promise.all([
    UserModel.findById(actorUserId).select("roles").lean(),
    UserModel.findById(targetUserId),
  ]);

  if (!actor || !isAdmin(actor.roles)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  if (!target || target.deletedAt) {
    throw new AppError("User not found", "NOT_FOUND", 404);
  }

  // Admin and super admin have the same powers here: either can manage any admin or manager.
  const targetIsSuperAdmin = target.roles.includes(Roles.SUPER_ADMIN);

  if (isManagerOnly(target.roles)) {
    target.roles = target.roles.filter((r) => r !== Roles.MANAGER);
    if (target.roles.length === 0) target.roles = [Roles.PATIENT];
    await target.save();
    await recordAdminActivity({
      actor: actorUserId,
      action: "admin.access_revoked",
      entityType: "User",
      entityId: target._id.toString(),
      targetLabel: mapUserPii(target).name,
      changes: { role: Roles.MANAGER },
    });
    return { revoked: true };
  }

  if (!target.roles.includes(Roles.ADMIN) && !targetIsSuperAdmin) {
    throw new AppError("User is not an admin", "BAD_REQUEST", 400);
  }

  const adminCount = await countActiveAdmins();
  if (adminCount <= 1) {
    throw new AppError(
      "Cannot remove the last admin on the platform",
      "FORBIDDEN",
      403,
    );
  }

  if (targetIsSuperAdmin) {
    target.roles = target.roles.filter(
      (r) => r !== Roles.SUPER_ADMIN && r !== Roles.ADMIN,
    );
  } else {
    target.roles = target.roles.filter((r) => r !== Roles.ADMIN);
  }
  // An admin-only account must keep a role; it falls back to a plain patient.
  if (target.roles.length === 0) target.roles = [Roles.PATIENT];

  await target.save();

  await recordAdminActivity({
    actor: actorUserId,
    action: "admin.access_revoked",
    entityType: "User",
    entityId: target._id.toString(),
    targetLabel: mapUserPii(target).name,
  });

  return { revoked: true };
}
