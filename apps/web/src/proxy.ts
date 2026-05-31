import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { authConfig } from "@/lib/auth/auth.config";
import {
  AUTH_ROUTES,
  DOCTOR_VERIFICATION_EXEMPT_PREFIXES,
  isPublicPath,
  matchesPrefix,
  ONBOARDING_EXEMPT_PREFIXES,
  ROLE_ROUTE_RULES,
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
    const onboarding = new URL(AUTH_ROUTES.onboarding, req.nextUrl.origin);
    if (pathname !== onboarding.pathname) {
      return NextResponse.redirect(onboarding);
    }
  }

  const isDoctor = roles.includes(Roles.DOCTOR);
  const doctorPending =
    isDoctor &&
    user.doctorVerificationStatus &&
    user.doctorVerificationStatus !== VerificationStatuses.APPROVED;

  if (
    doctorPending &&
    pathname.startsWith("/doctor") &&
    !matchesPrefix(pathname, DOCTOR_VERIFICATION_EXEMPT_PREFIXES)
  ) {
    return NextResponse.redirect(
      new URL(AUTH_ROUTES.doctorProfile, req.nextUrl.origin),
    );
  }

  for (const rule of ROLE_ROUTE_RULES) {
    if (pathname.startsWith(rule.prefix)) {
      const allowed = rule.roles.some((r) => roles.includes(r));
      if (!allowed) {
        return NextResponse.redirect(
          new URL(AUTH_ROUTES.patientDashboard, req.nextUrl.origin),
        );
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
