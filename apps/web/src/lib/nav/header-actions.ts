import { isAdminPanelUser, Roles, type Role } from "@zindagi/shared";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { siteConfig } from "@/config/site";

export type DashboardMenuLink = {
  href: string;
  label: string;
};

/** Each provider role's own messages page; everyone else uses the patient inbox. */
const PROVIDER_MESSAGES_HREF: [Role, string][] = [
  [Roles.DOCTOR, AUTH_ROUTES.doctorMessages],
  [Roles.HERBALIST, AUTH_ROUTES.herbalistMessages],
  [Roles.NUTRITIONIST, AUTH_ROUTES.nutritionistMessages],
  [Roles.NURSE, AUTH_ROUTES.nurseMessages],
  [Roles.PHYSIOTHERAPIST, AUTH_ROUTES.physiotherapistMessages],
];

export function messagesHref(roles?: Role[]) {
  return (
    PROVIDER_MESSAGES_HREF.find(([role]) => roles?.includes(role))?.[1] ??
    AUTH_ROUTES.messages
  );
}

export function dashboardHref(roles?: Role[]) {
  if (roles?.includes(Roles.DOCTOR)) return AUTH_ROUTES.doctorProfile;
  if (isAdminPanelUser(roles)) {
    return AUTH_ROUTES.adminDashboard;
  }
  if (roles?.includes(Roles.NURSE)) return AUTH_ROUTES.nurseDashboard;
  return siteConfig.links.dashboard;
}

export type HeaderAccountType = "patient" | "doctor" | "nurse" | "admin";

export function resolveHeaderAccountType(roles?: Role[]): HeaderAccountType {
  if (roles?.includes(Roles.DOCTOR)) return "doctor";
  if (roles?.includes(Roles.NURSE)) return "nurse";
  if (isAdminPanelUser(roles)) {
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
  if (isAdminPanelUser(roles)) {
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
