import { Roles, type Role } from "../types/enums";

/**
 * Account role invariant: an account is either a patient or exactly one clinical
 * provider, never both. Admin, rider, lab and other roles sit alongside and are
 * not affected (lab/other accounts are also patients by design).
 */
export const CLINICAL_ROLES = [
  Roles.DOCTOR,
  Roles.NURSE,
  Roles.PHYSIOTHERAPIST,
  Roles.HERBALIST,
  Roles.NUTRITIONIST,
] as const satisfies readonly Role[];

export type ClinicalRole = (typeof CLINICAL_ROLES)[number];

export function isClinicalRole(role: Role): role is ClinicalRole {
  return (CLINICAL_ROLES as readonly Role[]).includes(role);
}

/** Why a role set breaks the invariant, or null when it is valid. */
export function roleSetViolation(roles: readonly Role[]): string | null {
  if (roles.length === 0) return "An account must have at least one role";
  const clinical = roles.filter(isClinicalRole);
  if (clinical.length > 1) return "An account can hold only one clinical role";
  if (clinical.length === 1 && roles.includes(Roles.PATIENT)) {
    return "A clinical account cannot also be a patient";
  }
  return null;
}

/** Make `role` the account's only clinical role, dropping patient and any other clinical role. */
export function withClinicalRole(roles: readonly Role[], role: ClinicalRole): Role[] {
  return [
    ...roles.filter((r) => r !== Roles.PATIENT && !isClinicalRole(r)),
    role,
  ];
}

export type RoleResolution =
  | { kind: "ok"; roles: Role[] }
  | { kind: "conflict"; reason: string };

/**
 * Decide the valid role set for a legacy account that breaks the invariant.
 * `activeProfileRoles` are the clinical roles backed by a live (non-deleted)
 * provider profile: exactly one wins; none makes the account a patient; more
 * than one needs a human decision.
 */
export function resolveAccountRoles(
  roles: readonly Role[],
  activeProfileRoles: readonly ClinicalRole[],
): RoleResolution {
  if (roleSetViolation(roles) === null) return { kind: "ok", roles: [...roles] };

  const backed = [...new Set(activeProfileRoles)].filter((r) => roles.includes(r));
  if (backed.length > 1) {
    return {
      kind: "conflict",
      reason: `Active profiles for several clinical roles: ${backed.join(", ")}`,
    };
  }
  if (backed.length === 1) return { kind: "ok", roles: withClinicalRole(roles, backed[0]) };

  const others = roles.filter((r) => r !== Roles.PATIENT && !isClinicalRole(r));
  return { kind: "ok", roles: [Roles.PATIENT, ...others] };
}
