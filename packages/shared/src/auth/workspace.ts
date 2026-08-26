import { Roles, type Role } from "../types/enums";
import { isAdmin } from "./rbac";

/** Active UI workspace — which profile the user is operating in. */
export type Workspace =
  | "patient"
  | "doctor"
  | "admin"
  | "nurse"
  | "physiotherapist"
  | "herbalist"
  | "nutritionist"
  | "rider";

const WORKSPACE_ROUTE_PREFIX: Record<Workspace, string | null> = {
  patient: "/dashboard",
  doctor: "/doctor",
  admin: "/admin",
  nurse: "/nurse",
  physiotherapist: "/physiotherapist",
  herbalist: "/herbalist",
  nutritionist: "/nutritionist",
  rider: "/rider",
};

export function getAvailableWorkspaces(roles: Role[] | undefined): Workspace[] {
  const list = roles ?? [];
  const workspaces: Workspace[] = [];

  // Dual-role users (e.g. doctor + patient) get every workspace their roles allow.
  if (list.includes(Roles.PATIENT)) workspaces.push("patient");
  if (list.includes(Roles.DOCTOR)) workspaces.push("doctor");
  if (isAdmin(list)) workspaces.push("admin");
  if (list.includes(Roles.NURSE)) workspaces.push("nurse");
  if (list.includes(Roles.PHYSIOTHERAPIST)) workspaces.push("physiotherapist");
  if (list.includes(Roles.HERBALIST)) workspaces.push("herbalist");
  if (list.includes(Roles.NUTRITIONIST)) workspaces.push("nutritionist");
  if (list.includes(Roles.RIDER)) workspaces.push("rider");

  return workspaces;
}

/** Prefer clinical staff workspace over admin when the user has both. */
export function resolveDefaultWorkspace(roles: Role[] | undefined): Workspace {
  const list = roles ?? [];

  if (list.includes(Roles.DOCTOR)) return "doctor";
  if (list.includes(Roles.NURSE)) return "nurse";
  if (list.includes(Roles.PHYSIOTHERAPIST)) return "physiotherapist";
  if (list.includes(Roles.HERBALIST)) return "herbalist";
  if (list.includes(Roles.NUTRITIONIST)) return "nutritionist";
  if (list.includes(Roles.RIDER)) return "rider";
  if (isAdmin(list)) return "admin";
  return "patient";
}

export function workspaceForRoutePrefix(prefix: string): Workspace | null {
  if (prefix === "/doctor") return "doctor";
  if (prefix === "/admin") return "admin";
  if (prefix === "/nurse") return "nurse";
  if (prefix === "/physiotherapist") return "physiotherapist";
  if (prefix === "/herbalist") return "herbalist";
  if (prefix === "/nutritionist") return "nutritionist";
  if (prefix === "/rider") return "rider";
  return null;
}

export function workspaceMatchesRoute(
  workspace: Workspace | undefined,
  routePrefix: string,
): boolean {
  const required = workspaceForRoutePrefix(routePrefix);
  if (!required) return true;
  return workspace === required;
}

export function workspaceHomePath(workspace: Workspace): string {
  return WORKSPACE_ROUTE_PREFIX[workspace] ?? "/dashboard";
}

export function canUseWorkspace(
  roles: Role[] | undefined,
  workspace: Workspace,
): boolean {
  return getAvailableWorkspaces(roles).includes(workspace);
}
