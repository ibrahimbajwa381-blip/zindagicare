import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import {
  Roles,
  VerificationStatuses,
  canUsePatientWorkspace,
  workspaceMatchesRoute,
} from "@zindagi/shared";
import { authConfig } from "@/lib/auth/auth.config";
import {
  AUTH_ROUTES,
  DOCTOR_VERIFICATION_EXEMPT_PREFIXES,
  NURSE_VERIFICATION_EXEMPT_PREFIXES,
  PHYSIOTHERAPIST_VERIFICATION_EXEMPT_PREFIXES,
  isPublicPath,
  matchesPrefix,
  isPatientDashboardPath,
  ONBOARDING_EXEMPT_PREFIXES,
  ROLE_ROUTE_RULES,
  needsPatientProfileCompletion,
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
  const activeWorkspace = user.activeWorkspace;

  if (
    needsPatientProfileCompletion(user) &&
    !matchesPrefix(pathname, ONBOARDING_EXEMPT_PREFIXES)
  ) {
    const destination = resolvePostAuthPath(user);
    const target = new URL(destination, req.nextUrl.origin);
    if (pathname !== target.pathname) {
      return NextResponse.redirect(target);
    }
  }

  if (
    isPatientDashboardPath(pathname) &&
    !canUsePatientWorkspace(roles, activeWorkspace)
  ) {
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

  for (const rule of ROLE_ROUTE_RULES) {
    if (pathname.startsWith(rule.prefix)) {
      const hasRole = rule.roles.some((r) => roles.includes(r));
      const inWorkspace = workspaceMatchesRoute(activeWorkspace, rule.prefix);
      if (!hasRole || !inWorkspace) {
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
    "/prescriptions",
    "/prescriptions/:path*",
    "/doctor/:path*",
    "/admin/:path*",
    "/nurse/:path*",
    "/physiotherapist/:path*",
    "/rider/:path*",
    "/messages/:path*",
    "/assistant",
    "/assistant/:path*",
    "/intake/:path*",
    "/onboarding/:path*",
    "/home-care/visits/:path*",
    "/logout",
  ],
};
