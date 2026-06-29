import { isAdmin, Roles, type Workspace } from "@zindagi/shared";
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

export function messagesHref(roles?: string[]) {
  if (roles?.includes(Roles.DOCTOR)) return AUTH_ROUTES.doctorMessages;
  return AUTH_ROUTES.messages;
}

export function dashboardHref(roles?: string[]) {
  if (roles?.includes(Roles.DOCTOR)) return AUTH_ROUTES.doctorProfile;
  if (roles?.includes(Roles.ADMIN) || roles?.includes(Roles.SUPER_ADMIN)) {
    return AUTH_ROUTES.adminDashboard;
  }
  if (roles?.includes(Roles.NURSE)) return AUTH_ROUTES.nurseDashboard;
  return siteConfig.links.dashboard;
}

export type HeaderAccountType = "patient" | "doctor" | "nurse" | "admin";

export function resolveHeaderAccountType(roles?: string[]): HeaderAccountType {
  if (roles?.includes(Roles.DOCTOR)) return "doctor";
  if (roles?.includes(Roles.NURSE)) return "nurse";
  if (roles?.includes(Roles.ADMIN) || roles?.includes(Roles.SUPER_ADMIN)) {
    return "admin";
  }
  return "patient";
}

export function resolveDashboardMenuLinks(
  roles: string[] | undefined,
  labels: {
    myDashboard: string;
    doctorDashboard: string;
    adminDashboard: string;
  },
): DashboardMenuLink[] {
  const hasDoctor = roles?.includes(Roles.DOCTOR) ?? false;
  const hasAdminRole = isAdmin(roles);

  if (hasDoctor && hasAdminRole) {
    return [
      {
        href: AUTH_ROUTES.doctorProfile,
        label: labels.doctorDashboard,
        workspace: "doctor",
      },
      {
        href: AUTH_ROUTES.adminDashboard,
        label: labels.adminDashboard,
        workspace: "admin",
      },
    ];
  }

  const href = dashboardHref(roles);
  return [
    {
      href,
      label: labels.myDashboard,
      workspace: workspaceForDashboardHref(href),
    },
  ];
}
