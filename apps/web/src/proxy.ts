import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { isStaff, Roles, VerificationStatuses } from "@zindagi/shared";
import { authConfig } from "@/lib/auth/auth.config";
import {
  AUTH_ROUTES,
  DOCTOR_VERIFICATION_EXEMPT_PREFIXES,
  NURSE_VERIFICATION_EXEMPT_PREFIXES,
  isPublicPath,
  matchesPrefix,
  isPatientDashboardPath,
  ONBOARDING_EXEMPT_PREFIXES,
  ROLE_ROUTE_RULES,
  resolvePostAuthPath,
} from "@/lib/auth/routes";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
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

  if (
    !user.onboardingCompleted &&
    !matchesPrefix(pathname, ONBOARDING_EXEMPT_PREFIXES)
  ) {
    const destination = resolvePostAuthPath(user);
    const target = new URL(destination, req.nextUrl.origin);
    if (pathname !== target.pathname) {
      return NextResponse.redirect(target);
    }
  }

  if (isPatientDashboardPath(pathname) && isStaff(roles)) {
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

  for (const rule of ROLE_ROUTE_RULES) {
    if (pathname.startsWith(rule.prefix)) {
      const allowed = rule.roles.some((r) => roles.includes(r));
      if (!allowed) {
        return NextResponse.redirect(
          new URL(resolvePostAuthPath(user), req.nextUrl.origin),
        );
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/consult/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/doctor/:path*",
    "/admin/:path*",
    "/nurse/:path*",
    "/rider/:path*",
    "/messages/:path*",
    "/intake/:path*",
    "/onboarding/:path*",
    "/home-care/visits/:path*",
    "/logout",
  ],
};
