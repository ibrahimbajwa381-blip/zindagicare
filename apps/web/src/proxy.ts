import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { Roles, VerificationStatuses, canUsePatientWorkspace } from "@zindagi/shared";
import { authConfig } from "@/lib/auth/auth.config";
import { REFERRAL_COOKIE_NAME } from "@/lib/doctors/referral-cookie";
import {
  AUTH_ROUTES,
  DOCTOR_VERIFICATION_EXEMPT_PREFIXES,
  NURSE_VERIFICATION_EXEMPT_PREFIXES,
  PHYSIOTHERAPIST_VERIFICATION_EXEMPT_PREFIXES,
  HERBALIST_VERIFICATION_EXEMPT_PREFIXES,
  NUTRITIONIST_VERIFICATION_EXEMPT_PREFIXES,
  isPublicPath,
  matchesPrefix,
  isPatientDashboardPath,
  ONBOARDING_EXEMPT_PREFIXES,
  ROLE_ROUTE_RULES,
  needsPatientProfileCompletion,
  resolvePostAuthPath,
} from "@/lib/auth/routes";

const { auth } = NextAuth(authConfig);

/** Referral codes are short random base64url tokens — reject anything else outright. */
const REFERRAL_CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;
const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Fallback capture for the doctor-referral cookie: /r/[code] already sets it on redirect,
 * but if that Set-Cookie header ever gets dropped by some intermediary, any later request
 * that still carries `?ref=<code>` (e.g. the doctor profile page it redirected to) re-sets
 * it here so the signup flow still picks it up.
 */
function withReferralCookie(req: NextRequest, response: NextResponse): NextResponse {
  const ref = req.nextUrl.searchParams.get("ref");
  if (ref && REFERRAL_CODE_RE.test(ref)) {
    response.cookies.set(REFERRAL_COOKIE_NAME, ref, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
    });
  }
  return response;
}

export default auth((req) => {
  return withReferralCookie(req, routeGuard(req));
});

function routeGuard(req: Parameters<Parameters<typeof auth>[0]>[0]) {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session?.user;

  if (isPublicPath(pathname) || pathname.startsWith("/api/webhooks")) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const login = new URL(AUTH_ROUTES.login, req.nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  const user = session!.user;
  const roles = user.roles ?? [];

  // Patient onboarding only applies to patient-only accounts. Staff/admin users
  // often have onboardingCompleted=false but must still reach their workspaces
  // (e.g. /admin/doctors) — otherwise middleware traps them on /admin.
  if (
    canUsePatientWorkspace(roles) &&
    needsPatientProfileCompletion(user) &&
    !matchesPrefix(pathname, ONBOARDING_EXEMPT_PREFIXES)
  ) {
    const destination = resolvePostAuthPath(user);
    const target = new URL(destination, req.nextUrl.origin);
    if (pathname !== target.pathname) {
      return NextResponse.redirect(target);
    }
  }

  if (isPatientDashboardPath(pathname) && !canUsePatientWorkspace(roles)) {
    const destination = resolvePostAuthPath(user);
    if (pathname !== destination) {
      return NextResponse.redirect(
        new URL(destination, req.nextUrl.origin),
      );
    }
  }

  const isDoctor = roles.includes(Roles.DOCTOR);
  const doctorNeedsVerification =
    isDoctor &&
    user.doctorVerificationStatus &&
    (user.doctorVerificationStatus === VerificationStatuses.PENDING ||
      user.doctorVerificationStatus === VerificationStatuses.REJECTED);

  if (
    doctorNeedsVerification &&
    pathname.startsWith("/doctor") &&
    !matchesPrefix(pathname, DOCTOR_VERIFICATION_EXEMPT_PREFIXES)
  ) {
    return NextResponse.redirect(
      new URL(AUTH_ROUTES.doctorVerification, req.nextUrl.origin),
    );
  }

  const isNurse = roles.includes(Roles.NURSE);
  const nursePending =
    isNurse &&
    user.nurseVerificationStatus &&
    user.nurseVerificationStatus !== VerificationStatuses.APPROVED;

  if (
    nursePending &&
    pathname.startsWith("/nurse") &&
    !matchesPrefix(pathname, NURSE_VERIFICATION_EXEMPT_PREFIXES)
  ) {
    return NextResponse.redirect(
      new URL(AUTH_ROUTES.nurseVerification, req.nextUrl.origin),
    );
  }

  const isPhysiotherapist = roles.includes(Roles.PHYSIOTHERAPIST);
  const physiotherapistPending =
    isPhysiotherapist &&
    user.physiotherapistVerificationStatus &&
    user.physiotherapistVerificationStatus !== VerificationStatuses.APPROVED;

  if (
    physiotherapistPending &&
    pathname.startsWith("/physiotherapist") &&
    !matchesPrefix(pathname, PHYSIOTHERAPIST_VERIFICATION_EXEMPT_PREFIXES)
  ) {
    return NextResponse.redirect(
      new URL(AUTH_ROUTES.physiotherapistVerification, req.nextUrl.origin),
    );
  }

  const isHerbalist = roles.includes(Roles.HERBALIST);
  const herbalistPending =
    isHerbalist &&
    user.herbalistVerificationStatus &&
    user.herbalistVerificationStatus !== VerificationStatuses.APPROVED;

  if (
    herbalistPending &&
    pathname.startsWith("/herbalist") &&
    !matchesPrefix(pathname, HERBALIST_VERIFICATION_EXEMPT_PREFIXES)
  ) {
    return NextResponse.redirect(
      new URL(AUTH_ROUTES.herbalistVerification, req.nextUrl.origin),
    );
  }

  const isNutritionist = roles.includes(Roles.NUTRITIONIST);
  const nutritionistPending =
    isNutritionist &&
    user.nutritionistVerificationStatus &&
    user.nutritionistVerificationStatus !== VerificationStatuses.APPROVED;

  if (
    nutritionistPending &&
    pathname.startsWith("/nutritionist") &&
    !matchesPrefix(pathname, NUTRITIONIST_VERIFICATION_EXEMPT_PREFIXES)
  ) {
    return NextResponse.redirect(
      new URL(AUTH_ROUTES.nutritionistVerification, req.nextUrl.origin),
    );
  }

  for (const rule of ROLE_ROUTE_RULES) {
    if (pathname.startsWith(rule.prefix)) {
      const hasRole = rule.roles.some((r) => roles.includes(r));
      if (!hasRole) {
        return NextResponse.redirect(
          new URL(resolvePostAuthPath(user), req.nextUrl.origin),
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Referral-cookie fallback capture also needs these public routes matched (see
    // withReferralCookie) — routeGuard itself no-ops on them via isPublicPath.
    "/",
    "/doctors",
    "/doctors/:path*",
    "/register",
    "/register/:path*",
    "/login",
    "/login/:path*",
    "/consult/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/prescriptions",
    "/prescriptions/:path*",
    "/doctor",
    "/doctor/:path*",
    "/admin",
    "/admin/:path*",
    "/nurse",
    "/nurse/:path*",
    "/physiotherapist",
    "/physiotherapist/:path*",
    "/herbalist",
    "/herbalist/:path*",
    "/nutritionist",
    "/nutritionist/:path*",
    "/rider",
    "/rider/:path*",
    "/messages",
    "/messages/:path*",
    "/assistant",
    "/assistant/:path*",
    "/intake/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/home-care/visits/:path*",
    "/logout",
  ],
};
