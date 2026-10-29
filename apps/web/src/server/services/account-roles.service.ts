/**
 * Brings legacy accounts in line with the one-role-per-account invariant
 * (see roleSetViolation). Used by scripts/normalize-account-roles.ts.
 *
 * Imports only @zindagi/* so the script can load it without the "@/" alias.
 */
import {
  AppointmentModel,
  connectDatabase,
  DoctorProfileModel,
  HerbalistProfileModel,
  NutritionistProfileModel,
  StaffProfileModel,
  UserModel,
} from "@zindagi/database";
import {
  CLINICAL_ROLES,
  resolveAccountRoles,
  roleSetViolation,
  Roles,
  type ClinicalRole,
  type Role,
} from "@zindagi/shared";

export type RoleFix = {
  userId: string;
  before: Role[];
  after: Role[];
  /** Bookings made as a patient; worth a look when the fix removes the patient role. */
  patientAppointments: number;
};

export type RoleConflict = { userId: string; roles: Role[]; reason: string };

export type RoleFixPlan = { fixes: RoleFix[]; conflicts: RoleConflict[] };

async function activeProfileRolesByUser(
  userIds: string[],
): Promise<Map<string, ClinicalRole[]>> {
  const live = { userId: { $in: userIds }, deletedAt: null };
  const [doctors, staff, herbalists, nutritionists] = await Promise.all([
    DoctorProfileModel.find(live).select("userId").lean(),
    StaffProfileModel.find({
      ...live,
      staffType: { $in: [Roles.NURSE, Roles.PHYSIOTHERAPIST] },
    })
      .select("userId staffType")
      .lean(),
    HerbalistProfileModel.find(live).select("userId").lean(),
    NutritionistProfileModel.find(live).select("userId").lean(),
  ]);

  const byUser = new Map<string, ClinicalRole[]>();
  const add = (userId: { toString(): string }, role: ClinicalRole) => {
    const key = userId.toString();
    byUser.set(key, [...(byUser.get(key) ?? []), role]);
  };
  for (const p of doctors) add(p.userId, Roles.DOCTOR);
  for (const p of staff) add(p.userId, p.staffType as ClinicalRole);
  for (const p of herbalists) add(p.userId, Roles.HERBALIST);
  for (const p of nutritionists) add(p.userId, Roles.NUTRITIONIST);
  return byUser;
}

/** Read-only: every account that breaks the invariant and what it would become. */
export async function planAccountRoleFixes(): Promise<RoleFixPlan> {
  await connectDatabase();

  const candidates = await UserModel.find({
    $or: [
      { roles: { $in: CLINICAL_ROLES } },
      { roles: { $size: 0 } },
      { roles: { $exists: false } },
    ],
  })
    .select("roles")
    .lean();

  const invalid = candidates.filter(
    (user) => roleSetViolation((user.roles ?? []) as Role[]) !== null,
  );
  if (invalid.length === 0) return { fixes: [], conflicts: [] };

  const [profileRoles, patientBookings] = await Promise.all([
    activeProfileRolesByUser(invalid.map((user) => user._id.toString())),
    AppointmentModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { patientId: { $in: invalid.map((user) => user._id) } } },
      { $group: { _id: "$patientId", count: { $sum: 1 } } },
    ]),
  ]);
  const bookingsByUser = new Map(
    patientBookings.map((row) => [String(row._id), row.count]),
  );

  const plan: RoleFixPlan = { fixes: [], conflicts: [] };
  for (const user of invalid) {
    const userId = user._id.toString();
    const roles = (user.roles ?? []) as Role[];
    const resolution = resolveAccountRoles(roles, profileRoles.get(userId) ?? []);
    if (resolution.kind === "conflict") {
      plan.conflicts.push({ userId, roles, reason: resolution.reason });
      continue;
    }
    plan.fixes.push({
      userId,
      before: roles,
      after: resolution.roles,
      patientAppointments: bookingsByUser.get(userId) ?? 0,
    });
  }
  return plan;
}

/**
 * Writes planned fixes. Each update only matches if the account's roles are still
 * exactly `before`, so a change made after planning is skipped, never overwritten.
 */
export async function applyAccountRoleFixes(
  fixes: RoleFix[],
): Promise<{ applied: string[]; skipped: string[] }> {
  await connectDatabase();

  const applied: string[] = [];
  const skipped: string[] = [];
  for (const fix of fixes) {
    const unchanged =
      fix.before.length === 0
        ? { $or: [{ roles: { $exists: false } }, { roles: { $size: 0 } }] }
        : { roles: fix.before };
    const result = await UserModel.updateOne(
      { _id: fix.userId, ...unchanged },
      { $set: { roles: fix.after } },
    );
    (result.modifiedCount === 1 ? applied : skipped).push(fix.userId);
  }
  return { applied, skipped };
}
