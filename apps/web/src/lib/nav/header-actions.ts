import { isAdmin, Roles, type Role } from "@zindagi/shared";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { siteConfig } from "@/config/site";

export type DashboardMenuLink = {
  href: string;
  label: string;
};

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

export function resolveHeaderAccountType(roles?: Role[]): HeaderAccountType {
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
    prescriptions?: string;
  },
): DashboardMenuLink[] {
  if (isAdmin(roles)) {
    return [{ href: AUTH_ROUTES.adminDashboard, label: labels.myDashboard }];
  }
  if (roles?.includes(Roles.DOCTOR)) {
    return [{ href: AUTH_ROUTES.doctorProfile, label: labels.myDashboard }];
  }
  if (roles?.includes(Roles.NURSE)) {
    return [{ href: AUTH_ROUTES.nurseDashboard, label: labels.myDashboard }];
  }
  const links: DashboardMenuLink[] = [{ href: dashboardHref(roles), label: labels.myDashboard }];
  if (labels.prescriptions) {
    links.push({ href: "/prescriptions", label: labels.prescriptions });
  }
  return links;
}
