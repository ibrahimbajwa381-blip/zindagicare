import {
  canUsePatientWorkspace,
  isAdmin,
  Roles,
  VerificationStatuses,
  type Role,
} from "@zindagi/shared";

export const AUTH_ROUTES = {
  login: "/login",
  register: "/register",
  registerDoctor: "/register/doctor",
  registerNurse: "/register/nurse",
  registerPhysiotherapist: "/register/physiotherapist",
  registerHerbalist: "/register/herbalist",
  registerNutritionist: "/register/nutritionist",
  forgotPassword: "/login/forgot-password",
  /** @deprecated Use forgotPassword — kept for old links */
  phoneLogin: "/login/forgot-password",
  onboarding: "/onboarding",
  doctorVerification: "/doctor/verification",
  doctorProfile: "/doctor/profile",
  doctorPortfolio: "/doctor/portfolio",
  patientDashboard: "/dashboard",
  adminDoctors: "/admin/doctors",
  adminDashboard: "/admin",
  adminHomeVisits: "/admin/home-visits",
  homeCareRequest: "/home-care/request",
  homeCareVisits: "/home-care/visits",
  nurseDashboard: "/nurse",
  nurseVerification: "/nurse/verification",
  nurseVisits: "/nurse/visits",
  nursePortfolio: "/nurse/portfolio",
  physiotherapistDashboard: "/physiotherapist",
  physiotherapistVerification: "/physiotherapist/verification",
  physiotherapistVisits: "/physiotherapist/visits",
  physiotherapistPortfolio: "/physiotherapist/portfolio",
  herbalistDashboard: "/herbalist",
  herbalistVerification: "/herbalist/verification",
  herbalistProfile: "/herbalist/profile",
  herbalistMessages: "/herbalist/messages",
  nutritionistDashboard: "/nutritionist",
  nutritionistVerification: "/nutritionist/verification",
  nutritionistProfile: "/nutritionist/profile",
  nutritionistMessages: "/nutritionist/messages",
  messages: "/messages",
  doctorMessages: "/doctor/messages",
  assistant: "/assistant",
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
  "/physiotherapists",
  "/nurses",
  "/herbalists",
  "/nutritionists",
  "/for-herbalists",
  "/for-nutritionists",
  "/home-care/request",
  AUTH_ROUTES.login,
  AUTH_ROUTES.register,
  AUTH_ROUTES.registerDoctor,
  AUTH_ROUTES.registerNurse,
  AUTH_ROUTES.registerPhysiotherapist,
  AUTH_ROUTES.registerHerbalist,
  AUTH_ROUTES.registerNutritionist,
  AUTH_ROUTES.forgotPassword,
  "/login/phone",
  "/api/auth",
  "/api/v1/sunday/doctors",
  "/api/v1/sunday/slots",
  "/api/v1/sunday/events",
  "/api/v1/consult/doctors",
  "/api/v1/consult/slots",
  "/api/payments/jazzcash",
  "/api/payments/easypaisa",
  "/api/v1/payments/providers",
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
  AUTH_ROUTES.adminDashboard,
  "/nurse/profile",
  "/doctor/patients",
  "/doctor/requests",
  "/doctor/urgent-calls",
  "/doctor/prescriptions",
  "/doctor/home-visits",
  "/doctor/sunday-consult",
  "/doctor/intake",
  "/doctor/messages",
  "/doctor/earnings",
  "/nurse",
  "/messages",
  "/assistant",
  "/consult",
  "/api/v1/auth/onboarding",
  "/api/v1/copilot",
  "/api/v1/doctor/verification",
  "/api/v1/doctor/profile",
  "/api/v1/nurse/verification",
  "/api/v1/nurse/profile",
  "/api/v1/physiotherapist/verification",
  "/api/v1/physiotherapist/profile",
  "/herbalist",
  "/nutritionist",
  "/api/v1/herbalist/verification",
  "/api/v1/herbalist/profile",
  "/api/v1/nutritionist/verification",
  "/api/v1/nutritionist/profile",
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
  "/doctor/intake",
  "/doctor/messages",
  "/doctor/earnings",
  "/consult",
  "/api/v1/doctor/verification",
  "/api/v1/doctor/profile",
  // Doctors can build their public portfolio while the application is under review.
  AUTH_ROUTES.doctorPortfolio,
  "/api/v1/doctor/portfolio",
] as const;

/** Nurse verification pending — can access these paths. */
export const NURSE_VERIFICATION_EXEMPT_PREFIXES = [
  AUTH_ROUTES.nurseVerification,
  "/nurse/profile",
  // Nurses can build their public portfolio while the application is under review.
  AUTH_ROUTES.nursePortfolio,
  AUTH_ROUTES.nurseDashboard,
  "/api/v1/nurse/verification",
  "/api/v1/nurse/profile",
  "/api/v1/nurse/portfolio",
] as const;

/** Physiotherapist verification pending — can access these paths. */
export const PHYSIOTHERAPIST_VERIFICATION_EXEMPT_PREFIXES = [
  AUTH_ROUTES.physiotherapistVerification,
  "/physiotherapist/profile",
  // Physios can build their public portfolio while the application is under review.
  AUTH_ROUTES.physiotherapistPortfolio,
  AUTH_ROUTES.physiotherapistDashboard,
  "/api/v1/physiotherapist/verification",
  "/api/v1/physiotherapist/profile",
  "/api/v1/physiotherapist/portfolio",
] as const;

/** Herbalist verification pending — can access these paths. */
export const HERBALIST_VERIFICATION_EXEMPT_PREFIXES = [
  AUTH_ROUTES.herbalistVerification,
  AUTH_ROUTES.herbalistProfile,
  AUTH_ROUTES.herbalistDashboard,
  "/api/v1/herbalist/verification",
  "/api/v1/herbalist/profile",
] as const;

/** Nutritionist verification pending — can access these paths. */
export const NUTRITIONIST_VERIFICATION_EXEMPT_PREFIXES = [
  AUTH_ROUTES.nutritionistVerification,
  AUTH_ROUTES.nutritionistProfile,
  AUTH_ROUTES.nutritionistDashboard,
  "/api/v1/nutritionist/verification",
  "/api/v1/nutritionist/profile",
] as const;

export type PostAuthUser = {
  roles?: Role[];
  onboardingCompleted?: boolean;
  /** False when account has no WhatsApp/mobile yet (e.g. Google signup). */
  hasPhone?: boolean;
  doctorVerificationStatus?: string;
  nurseVerificationStatus?: string;
  physiotherapistVerificationStatus?: string;
  herbalistVerificationStatus?: string;
  nutritionistVerificationStatus?: string;
};

/** Patient profile incomplete until city/locale onboarding and a WhatsApp number exist. */
export function needsPatientProfileCompletion(user: PostAuthUser): boolean {
  if (!user.onboardingCompleted) return true;
  // Only gate when we know phone is missing (legacy JWTs may omit hasPhone).
  return user.hasPhone === false;
}

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
  // Staff roles take priority over patient (doctor > nurse > physio > … > patient).
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

  if (roles.includes(Roles.HERBALIST)) {
    if (user.herbalistVerificationStatus === VerificationStatuses.APPROVED) {
      return AUTH_ROUTES.herbalistProfile;
    }
    return AUTH_ROUTES.herbalistVerification;
  }

  if (roles.includes(Roles.NUTRITIONIST)) {
    if (user.nutritionistVerificationStatus === VerificationStatuses.APPROVED) {
      return AUTH_ROUTES.nutritionistProfile;
    }
    return AUTH_ROUTES.nutritionistVerification;
  }

  if (roles.includes(Roles.RIDER)) {
    return "/rider";
  }

  if (canUsePatientWorkspace(roles)) {
    if (needsPatientProfileCompletion(user)) {
      return AUTH_ROUTES.onboarding;
    }
    return AUTH_ROUTES.patientDashboard;
  }

  return AUTH_ROUTES.patientDashboard;
}

export const ROLE_ROUTE_RULES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/doctor", roles: [Roles.DOCTOR] },
  { prefix: "/admin", roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
  { prefix: "/nurse", roles: [Roles.NURSE] },
  { prefix: "/physiotherapist", roles: [Roles.PHYSIOTHERAPIST] },
  { prefix: "/herbalist", roles: [Roles.HERBALIST] },
  { prefix: "/nutritionist", roles: [Roles.NUTRITIONIST] },
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
  "/herbalist",
  "/nutritionist",
  "/rider",
  "/messages",
  "/assistant",
  "/intake",
  "/onboarding",
  "/home-care/visits",
  "/logout",
] as const;
