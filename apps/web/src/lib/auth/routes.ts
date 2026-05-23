import { Roles, type Role } from "@zindagi/shared";

export const AUTH_ROUTES = {
  login: "/login",
  register: "/register",
  phoneLogin: "/login/phone",
  onboarding: "/onboarding",
  doctorVerification: "/doctor/verification",
  patientDashboard: "/dashboard",
  adminDoctors: "/admin/doctors",
} as const;

/** Paths reachable without a session. */
export const PUBLIC_PATH_PREFIXES = [
  "/",
  "/doctors",
  "/sunday-consult",
  "/home-services",
  AUTH_ROUTES.login,
  AUTH_ROUTES.register,
  AUTH_ROUTES.phoneLogin,
  "/api/auth",
  "/api/v1/sunday/doctors",
  "/api/v1/sunday/slots",
  "/api/v1/sunday/events",
  "/api/internal/seed-sunday",
  "/api/v1/auth/otp/request",
  "/api/v1/auth/register",
  "/api/health",
] as const;

/** Allowed while onboarding is incomplete. */
export const ONBOARDING_EXEMPT_PREFIXES = [
  AUTH_ROUTES.onboarding,
  "/api/v1/auth/onboarding",
  "/api/auth",
  "/logout",
] as const;

/** Doctor verification pending — can access these paths. */
export const DOCTOR_VERIFICATION_EXEMPT_PREFIXES = [
  AUTH_ROUTES.doctorVerification,
  "/api/v1/doctor/verification",
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
