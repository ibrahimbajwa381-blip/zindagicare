import { Roles } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import type { MobileNavLink, MobileNavSection } from "@/components/layout/mobile-nav";

export function dashboardHref(roles?: string[]) {
  if (roles?.includes(Roles.DOCTOR)) return AUTH_ROUTES.doctorProfile;
  if (roles?.includes(Roles.ADMIN) || roles?.includes(Roles.SUPER_ADMIN)) {
    return AUTH_ROUTES.adminDoctors;
  }
  return siteConfig.links.dashboard;
}

type AccountSectionLabels = {
  myDashboard: string;
  signOut: string;
  login: string;
  createAccount: string;
};

export function buildAccountMobileSection(
  session: { user: { name?: string | null; roles?: string[] } } | null,
  labels: AccountSectionLabels,
): MobileNavSection | null {
  if (!session?.user) {
    return {
      links: [
        { href: siteConfig.links.login, label: labels.login },
        { href: siteConfig.links.register, label: labels.createAccount },
      ],
    };
  }

  return {
    links: [
      {
        href: dashboardHref(session.user.roles),
        label: labels.myDashboard,
      },
      { label: labels.signOut, action: "sign-out" },
    ],
  };
}

export function buildMarketingMobileNav(
  session: { user: { roles?: string[] } } | null,
  labels: {
    home: string;
    onlineConsult: string;
    sundayConsult: string;
    homeServices: string;
    freeBadge: string;
    myDashboard: string;
    signOut: string;
    login: string;
    createAccount: string;
  },
): { links: MobileNavLink[]; sections: MobileNavSection[] } {
  const links: MobileNavLink[] = [
    { href: siteConfig.links.doctors, label: labels.onlineConsult },
    {
      href: siteConfig.links.sundayConsult,
      label: labels.sundayConsult,
      badge: labels.freeBadge,
    },
    { href: siteConfig.links.homeServices, label: labels.homeServices },
  ];

  const accountSection = buildAccountMobileSection(session, {
    myDashboard: labels.myDashboard,
    signOut: labels.signOut,
    login: labels.login,
    createAccount: labels.createAccount,
  });

  return {
    links,
    sections: accountSection ? [accountSection] : [],
  };
}
