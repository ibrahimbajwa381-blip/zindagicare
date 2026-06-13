import { Roles } from "@zindagi/shared";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { siteConfig } from "@/config/site";

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
