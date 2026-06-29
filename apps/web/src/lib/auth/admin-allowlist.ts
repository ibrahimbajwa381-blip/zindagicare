import { UserModel } from "@zindagi/database";
import { Roles, type Role } from "@zindagi/shared";

/** Comma-separated emails in ADMIN_ALLOWLIST_EMAILS receive the admin role on sign-in. */
export function parseAdminAllowlistEmails(): string[] {
  const raw = process.env.ADMIN_ALLOWLIST_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminAllowlistedEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return parseAdminAllowlistEmails().includes(normalized);
}

/** Grant admin role in DB when email is on the allowlist; returns updated roles. */
export async function syncAdminRoleFromAllowlist(
  userId: string,
  email: string | undefined | null,
  roles: Role[],
): Promise<Role[]> {
  if (!isAdminAllowlistedEmail(email)) return roles;
  if (roles.includes(Roles.ADMIN) || roles.includes(Roles.SUPER_ADMIN)) return roles;

  await UserModel.findByIdAndUpdate(userId, {
    $addToSet: { roles: Roles.ADMIN },
  });

  return [...roles, Roles.ADMIN];
}
