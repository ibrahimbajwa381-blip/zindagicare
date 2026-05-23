import type { Session } from "next-auth";
import { hasAnyRole, type Role } from "@zindagi/shared";
import { auth } from "./auth";

export type AuthSessionUser = NonNullable<Session["user"]>;

export async function getSession() {
  return auth();
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireRole(roles: Role | Role[]) {
  const session = await requireSession();
  if (!hasAnyRole(session.user.roles, roles)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export function sessionHasRole(
  session: Session | null | undefined,
  roles: Role | Role[],
) {
  return hasAnyRole(session?.user?.roles, roles);
}
