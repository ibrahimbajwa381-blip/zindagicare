import { Roles, type Role } from "@zindagi/shared";

export const AUTH_ROUTES = {
  login: "/login",
  register: "/register",
  phoneLogin: "/login/phone",
  onboarding: "/onboarding",
  doctorVerification: "/doctor/verification",
  doctorProfile: "/doctor/profile",
  patientDashboard: "/dashboard",
  adminDoctors: "/admin/doctors",
  adminDashboard: "/admin",
  adminHomeVisits: "/admin/home-visits",
  homeCareRequest: "/home-care/request",
  homeCareVisits: "/home-care/visits",
  nurseVisits: "/nurse/visits",
  messages: "/messages",
  doctorMessages: "/doctor/messages",
} as const;

/** Paths reachable without a session. */
export const PUBLIC_PATH_PREFIXES = [
  "/",
  "/doctors",
  "/doctors/booking",
  "/sunday-consult",
  "/home-services",
  "/home-care/request",
  AUTH_ROUTES.login,
  AUTH_ROUTES.register,
  AUTH_ROUTES.phoneLogin,
  "/api/auth",
  "/api/v1/sunday/doctors",
  "/api/v1/sunday/slots",
  "/api/v1/sunday/events",
  "/api/v1/consult/doctors",
  "/api/v1/consult/slots",
  "/api/payments/jazzcash",
  "/api/v1/payments/mock",
  "/api/v1/payments/test",
  "/api/internal/seed-home-care",
  "/api/internal/bootstrap-admin",
  "/api/v1/auth/otp/request",
  "/api/v1/auth/register",
  "/api/health",
] as const;

/** Allowed while onboarding is incomplete. */
export const ONBOARDING_EXEMPT_PREFIXES = [
  AUTH_ROUTES.onboarding,
  AUTH_ROUTES.doctorVerification,
  AUTH_ROUTES.doctorProfile,
  "/doctor/patients",
  "/doctor/requests",
  "/doctor/home-visits",
  "/doctor/sunday-consult",
  "/doctor/messages",
  "/messages",
  "/consult",
  "/api/v1/auth/onboarding",
  "/api/v1/doctor/verification",
  "/api/v1/doctor/profile",
  "/api/auth",
  "/logout",
] as const;

/** Doctor verification pending — can access these paths. */
export const DOCTOR_VERIFICATION_EXEMPT_PREFIXES = [
  AUTH_ROUTES.doctorVerification,
  AUTH_ROUTES.doctorProfile,
  "/doctor/patients",
  "/doctor/requests",
  "/doctor/home-visits",
  "/doctor/sunday-consult",
  "/doctor/messages",
  "/consult",
  "/api/v1/doctor/verification",
  "/api/v1/doctor/profile",
  AUTH_ROUTES.onboarding,
] as const;

export const ROLE_ROUTE_RULES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/doctor", roles: [Roles.DOCTOR] },
  { prefix: "/admin", roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
  { prefix: "/nurse", roles: [Roles.NURSE] },
  { prefix: "/rider", roles: [Roles.RIDER] },
];

export function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isPublicPath(pathname: string) {
  return matchesPrefix(pathname, PUBLIC_PATH_PREFIXES);
}

/**
 * Protected app routes that run auth middleware.
 * Keep in sync with the matcher in apps/web/src/proxy.ts.
 * Marketing pages, public APIs, and SSE streams are intentionally omitted.
 */
export const MIDDLEWARE_PROTECTED_PREFIXES = [
  "/consult",
  "/dashboard",
  "/doctor",
  "/admin",
  "/nurse",
  "/rider",
  "/messages",
  "/onboarding",
  "/home-care/visits",
  "/logout",
] as const;
