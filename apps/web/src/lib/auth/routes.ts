import {
  canUsePatientWorkspace,
  isAdmin,
  resolveDefaultWorkspace,
  Roles,
  VerificationStatuses,
  type Role,
  type Workspace,
} from "@zindagi/shared";

export const AUTH_ROUTES = {
  login: "/login",
  register: "/register",
  registerDoctor: "/register/doctor",
  registerNurse: "/register/nurse",
  registerPhysiotherapist: "/register/physiotherapist",
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
  nurseDashboard: "/nurse",
  nurseVerification: "/nurse/verification",
  nurseVisits: "/nurse/visits",
  physiotherapistDashboard: "/physiotherapist",
  physiotherapistVerification: "/physiotherapist/verification",
  physiotherapistVisits: "/physiotherapist/visits",
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
  "/for-doctors",
  "/for-nurses",
  "/for-physiotherapists",
  "/home-care/request",
  AUTH_ROUTES.login,
  AUTH_ROUTES.register,
  AUTH_ROUTES.registerDoctor,
  AUTH_ROUTES.registerNurse,
  AUTH_ROUTES.registerPhysiotherapist,
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
  "/api/internal/bootstrap-admin",
  "/api/v1/auth/otp/request",
  "/api/v1/auth/register",
  "/api/health",
] as const;

/** Allowed while patient onboarding is incomplete. */
export const ONBOARDING_EXEMPT_PREFIXES = [
  AUTH_ROUTES.onboarding,
  AUTH_ROUTES.doctorVerification,
  AUTH_ROUTES.doctorProfile,
  AUTH_ROUTES.nurseVerification,
  "/nurse/profile",
  "/doctor/patients",
  "/doctor/requests",
  "/doctor/urgent-calls",
  "/doctor/prescriptions",
  "/doctor/home-visits",
  "/doctor/sunday-consult",
  "/doctor/messages",
  "/doctor/earnings",
  "/nurse",
  "/messages",
  "/consult",
  "/api/v1/auth/onboarding",
  "/api/v1/doctor/verification",
  "/api/v1/doctor/profile",
  "/api/v1/nurse/verification",
  "/api/v1/nurse/profile",
  "/api/v1/physiotherapist/verification",
  "/api/v1/physiotherapist/profile",
  "/api/auth",
  "/logout",
] as const;

/** Doctor verification pending — can access these paths. */
export const DOCTOR_VERIFICATION_EXEMPT_PREFIXES = [
  AUTH_ROUTES.doctorVerification,
  AUTH_ROUTES.doctorProfile,
  "/doctor/patients",
  "/doctor/requests",
  "/doctor/urgent-calls",
  "/doctor/prescriptions",
  "/doctor/home-visits",
  "/doctor/sunday-consult",
  "/doctor/messages",
  "/doctor/earnings",
  "/consult",
  "/api/v1/doctor/verification",
  "/api/v1/doctor/profile",
] as const;

/** Nurse verification pending — can access these paths. */
export const NURSE_VERIFICATION_EXEMPT_PREFIXES = [
  AUTH_ROUTES.nurseVerification,
  "/nurse/profile",
  AUTH_ROUTES.nurseDashboard,
  "/api/v1/nurse/verification",
  "/api/v1/nurse/profile",
] as const;

/** Physiotherapist verification pending — can access these paths. */
export const PHYSIOTHERAPIST_VERIFICATION_EXEMPT_PREFIXES = [
  AUTH_ROUTES.physiotherapistVerification,
  "/physiotherapist/profile",
  AUTH_ROUTES.physiotherapistDashboard,
  "/api/v1/physiotherapist/verification",
  "/api/v1/physiotherapist/profile",
] as const;

export type PostAuthUser = {
  roles?: Role[];
  activeWorkspace?: Workspace;
  onboardingCompleted?: boolean;
  doctorVerificationStatus?: string;
  nurseVerificationStatus?: string;
  physiotherapistVerificationStatus?: string;
};

export function isPatientDashboardPath(pathname: string) {
  return (
    pathname === AUTH_ROUTES.patientDashboard ||
    pathname.startsWith(`${AUTH_ROUTES.patientDashboard}/`) ||
    pathname === "/prescriptions" ||
    pathname.startsWith("/prescriptions/")
  );
}

/** Default landing path after sign-in (replaces generic /dashboard for staff). */
export function resolveLoginRedirectPath(
  user: PostAuthUser,
  callbackUrl?: string,
): string {
  const requested = callbackUrl?.trim();
  if (requested && requested !== AUTH_ROUTES.patientDashboard) {
    return requested;
  }
  return resolvePostAuthPath(user);
}

export function resolvePostAuthPath(user: PostAuthUser): string {
  const roles = user.roles ?? [];
  const workspace =
    user.activeWorkspace ?? resolveDefaultWorkspace(roles);

  if (workspace === "admin" && isAdmin(roles)) {
    return AUTH_ROUTES.adminDashboard;
  }

  if (workspace === "doctor" && roles.includes(Roles.DOCTOR)) {
    if (user.doctorVerificationStatus === VerificationStatuses.APPROVED) {
      return AUTH_ROUTES.doctorProfile;
    }
    return AUTH_ROUTES.doctorVerification;
  }

  if (workspace === "nurse" && roles.includes(Roles.NURSE)) {
    if (user.nurseVerificationStatus === VerificationStatuses.APPROVED) {
      return AUTH_ROUTES.nurseDashboard;
    }
    return AUTH_ROUTES.nurseVerification;
  }

  if (workspace === "physiotherapist" && roles.includes(Roles.PHYSIOTHERAPIST)) {
    if (user.physiotherapistVerificationStatus === VerificationStatuses.APPROVED) {
      return AUTH_ROUTES.physiotherapistDashboard;
    }
    return AUTH_ROUTES.physiotherapistVerification;
  }

  if (workspace === "rider" && roles.includes(Roles.RIDER)) {
    return "/rider";
  }

  if (canUsePatientWorkspace(roles, workspace)) {
    if (!user.onboardingCompleted) {
      return AUTH_ROUTES.onboarding;
    }
    return AUTH_ROUTES.patientDashboard;
  }

  // Fallback when active workspace is stale or mismatched
  if (isAdmin(roles)) {
    return AUTH_ROUTES.adminDashboard;
  }

  if (roles.includes(Roles.DOCTOR)) {
    if (user.doctorVerificationStatus === VerificationStatuses.APPROVED) {
      return AUTH_ROUTES.doctorProfile;
    }
    return AUTH_ROUTES.doctorVerification;
  }

  if (roles.includes(Roles.NURSE)) {
    if (user.nurseVerificationStatus === VerificationStatuses.APPROVED) {
      return AUTH_ROUTES.nurseDashboard;
    }
    return AUTH_ROUTES.nurseVerification;
  }

  if (roles.includes(Roles.PHYSIOTHERAPIST)) {
    if (user.physiotherapistVerificationStatus === VerificationStatuses.APPROVED) {
      return AUTH_ROUTES.physiotherapistDashboard;
    }
    return AUTH_ROUTES.physiotherapistVerification;
  }

  if (!user.onboardingCompleted) {
    return AUTH_ROUTES.onboarding;
  }

  return AUTH_ROUTES.patientDashboard;
}

export const ROLE_ROUTE_RULES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/doctor", roles: [Roles.DOCTOR] },
  { prefix: "/admin", roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
  { prefix: "/nurse", roles: [Roles.NURSE] },
  { prefix: "/physiotherapist", roles: [Roles.PHYSIOTHERAPIST] },
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
  "/physiotherapist",
  "/rider",
  "/messages",
  "/intake",
  "/onboarding",
  "/home-care/visits",
  "/logout",
] as const;
