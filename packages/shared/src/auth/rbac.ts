import { Roles, type Role } from "../types/enums";
import type { Workspace } from "./workspace";

/** Ordered from least to most privileged (for hierarchy checks). */
export const ROLE_RANK: Record<Role, number> = {
  [Roles.PATIENT]: 0,
  [Roles.RIDER]: 10,
  [Roles.NURSE]: 20,
  [Roles.PHYSIOTHERAPIST]: 25,
  [Roles.DOCTOR]: 30,
  [Roles.ADMIN]: 40,
  [Roles.SUPER_ADMIN]: 50,
};

export function hasRole(userRoles: Role[] | undefined, required: Role): boolean {
  return (userRoles ?? []).includes(required);
}

export function hasAnyRole(
  userRoles: Role[] | undefined,
  required: Role | Role[],
): boolean {
  const list = Array.isArray(required) ? required : [required];
  const roles = userRoles ?? [];
  return list.some((r) => roles.includes(r));
}

export function hasAllRoles(
  userRoles: Role[] | undefined,
  required: Role[],
): boolean {
  const roles = userRoles ?? [];
  return required.every((r) => roles.includes(r));
}

export function isAdmin(userRoles: Role[] | undefined): boolean {
  return hasAnyRole(userRoles, [Roles.ADMIN, Roles.SUPER_ADMIN]);
}

export const STAFF_ROLES: Role[] = [
  Roles.NURSE,
  Roles.PHYSIOTHERAPIST,
  Roles.RIDER,
  Roles.DOCTOR,
  Roles.ADMIN,
  Roles.SUPER_ADMIN,
];

export function isStaff(userRoles: Role[] | undefined): boolean {
  return hasAnyRole(userRoles, STAFF_ROLES);
}

/** True when the user is a patient account, not staff (doctor, nurse, admin, etc.). */
export function isPatientOnly(userRoles: Role[] | undefined): boolean {
  const roles = userRoles ?? [];
  return roles.includes(Roles.PATIENT) && !isStaff(roles);
}

/** Patient dashboard when the user has the patient role and is in the patient workspace. */
export function canUsePatientWorkspace(
  userRoles: Role[] | undefined,
  activeWorkspace?: Workspace,
): boolean {
  const roles = userRoles ?? [];
  if (!roles.includes(Roles.PATIENT)) return false;
  if (!isStaff(roles)) return true;
  return activeWorkspace === "patient";
}

export function highestRole(userRoles: Role[] | undefined): Role {
  const roles = userRoles ?? [Roles.PATIENT];
  return roles.reduce(
    (best, r) => (ROLE_RANK[r] > ROLE_RANK[best] ? r : best),
    Roles.PATIENT,
  );
}

/** Fine-grained permissions keyed by action. */
export const Permissions = {
  "admin.users.read": [Roles.ADMIN, Roles.SUPER_ADMIN],
  "admin.users.write": [Roles.ADMIN, Roles.SUPER_ADMIN],
  "admin.doctors.verify": [Roles.ADMIN, Roles.SUPER_ADMIN],
  "doctor.profile.manage": [Roles.DOCTOR],
  "doctor.sunday.manage": [Roles.DOCTOR],
  "patient.book": [Roles.PATIENT],
  "staff.deliveries": [Roles.RIDER],
  "staff.nursing": [Roles.NURSE],
  "staff.physiotherapy": [Roles.PHYSIOTHERAPIST],
} as const satisfies Record<string, Role[]>;

export type Permission = keyof typeof Permissions;

export function can(
  userRoles: Role[] | undefined,
  permission: Permission,
): boolean {
  return hasAnyRole(userRoles, Permissions[permission]);
}
