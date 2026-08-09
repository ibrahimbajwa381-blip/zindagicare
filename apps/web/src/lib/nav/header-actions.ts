import { isAdmin, Roles, type Role, type Workspace } from "@zindagi/shared";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { siteConfig } from "@/config/site";

export type DashboardMenuLink = {
  href: string;
  label: string;
  workspace: Workspace;
};

export function workspaceForDashboardHref(href: string): Workspace {
  if (
    href === AUTH_ROUTES.patientDashboard ||
    href.startsWith(`${AUTH_ROUTES.patientDashboard}/`)
  ) {
    return "patient";
  }

  const prefixes: [string, Workspace][] = [
    ["/doctor", "doctor"],
    ["/admin", "admin"],
    ["/nurse", "nurse"],
    ["/physiotherapist", "physiotherapist"],
    ["/rider", "rider"],
  ];

  for (const [prefix, workspace] of prefixes) {
    if (href === prefix || href.startsWith(`${prefix}/`)) {
      return workspace;
    }
  }

  return "patient";
}

export function messagesHref(roles?: Role[]) {
  if (roles?.includes(Roles.DOCTOR)) return AUTH_ROUTES.doctorMessages;
  return AUTH_ROUTES.messages;
}

export function dashboardHref(roles?: Role[]) {
  if (roles?.includes(Roles.DOCTOR)) return AUTH_ROUTES.doctorProfile;
  if (roles?.includes(Roles.ADMIN) || roles?.includes(Roles.SUPER_ADMIN)) {
    return AUTH_ROUTES.adminDashboard;
  }
  if (roles?.includes(Roles.NURSE)) return AUTH_ROUTES.nurseDashboard;
  return siteConfig.links.dashboard;
}

export type HeaderAccountType = "patient" | "doctor" | "nurse" | "admin";

export function resolveHeaderAccountType(
  roles?: Role[],
  activeWorkspace?: Workspace,
): HeaderAccountType {
  if (activeWorkspace === "patient" && roles?.includes(Roles.PATIENT)) {
    return "patient";
  }
  if (activeWorkspace === "doctor" && roles?.includes(Roles.DOCTOR)) {
    return "doctor";
  }
  if (activeWorkspace === "nurse" && roles?.includes(Roles.NURSE)) {
    return "nurse";
  }
  if (activeWorkspace === "admin" && isAdmin(roles)) {
    return "admin";
  }

  if (roles?.includes(Roles.DOCTOR)) return "doctor";
  if (roles?.includes(Roles.NURSE)) return "nurse";
  if (roles?.includes(Roles.ADMIN) || roles?.includes(Roles.SUPER_ADMIN)) {
    return "admin";
  }
  return "patient";
}

export function resolveDashboardMenuLinks(
  roles: Role[] | undefined,
  labels: {
    myDashboard: string;
    patientDashboard: string;
    doctorDashboard: string;
    adminDashboard: string;
  },
): DashboardMenuLink[] {
  const hasPatient = roles?.includes(Roles.PATIENT) ?? false;
  const hasDoctor = roles?.includes(Roles.DOCTOR) ?? false;
  const hasNurse = roles?.includes(Roles.NURSE) ?? false;
  const hasAdminRole = isAdmin(roles);

  const links: DashboardMenuLink[] = [];

  if (hasPatient) {
    links.push({
      href: AUTH_ROUTES.patientDashboard,
      label: labels.patientDashboard,
      workspace: "patient",
    });
  }
  if (hasDoctor) {
    links.push({
      href: AUTH_ROUTES.doctorProfile,
      label: labels.doctorDashboard,
      workspace: "doctor",
    });
  }
  if (hasNurse) {
    links.push({
      href: AUTH_ROUTES.nurseDashboard,
      label: labels.myDashboard,
      workspace: "nurse",
    });
  }
  if (hasAdminRole) {
    links.push({
      href: AUTH_ROUTES.adminDashboard,
      label: labels.adminDashboard,
      workspace: "admin",
    });
  }

  if (links.length === 0) {
    const href = dashboardHref(roles);
    return [
      {
        href,
        label: labels.myDashboard,
        workspace: workspaceForDashboardHref(href),
      },
    ];
  }

  if (links.length === 1) {
    return [{ ...links[0]!, label: labels.myDashboard }];
  }

  return links;
}
