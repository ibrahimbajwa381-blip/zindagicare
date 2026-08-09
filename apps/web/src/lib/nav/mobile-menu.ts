import { Roles, type Role } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { resolveDashboardMenuLinks } from "@/lib/nav/header-actions";
import type { MobileNavLink, MobileNavSection } from "@/components/layout/mobile-nav";

type AccountSectionLabels = {
  myDashboard: string;
  patientDashboard: string;
  doctorDashboard: string;
  adminDashboard: string;
  healthAssistant: string;
  signOut: string;
  login: string;
  createAccount: string;
};

export function buildAccountMobileSection(
  session: { user: { name?: string | null; roles?: Role[] } } | null,
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

  const dashboardLinks = resolveDashboardMenuLinks(session.user.roles, {
    myDashboard: labels.myDashboard,
    patientDashboard: labels.patientDashboard,
    doctorDashboard: labels.doctorDashboard,
    adminDashboard: labels.adminDashboard,
  });

  const patientLinks =
    session.user.roles?.includes(Roles.PATIENT) ?
      [{ href: siteConfig.links.assistant, label: labels.healthAssistant }]
    : [];

  return {
    links: [
      ...patientLinks.map((link) => ({ href: link.href, label: link.label })),
      ...dashboardLinks.map((link) => ({
        href: link.href,
        label: link.label,
        workspace: link.workspace,
      })),
      { label: labels.signOut, action: "sign-out" as const },
    ],
  };
}

export function buildMarketingMobileNav(
  session: { user: { roles?: Role[] } } | null,
  labels: {
    home: string;
    onlineConsult: string;
    sundayConsult: string;
    urgentCare: string;
    homeServices: string;
    homePhysio: string;
    freeBadge: string;
    urgentBadge: string;
    myDashboard: string;
    patientDashboard: string;
    doctorDashboard: string;
    adminDashboard: string;
    healthAssistant: string;
    signOut: string;
    login: string;
    createAccount: string;
  },
): { links: MobileNavLink[]; sections: MobileNavSection[] } {
  const links: MobileNavLink[] = [
    { href: siteConfig.links.homeServices, label: labels.homeServices },
    {
      href: siteConfig.links.homePhysiotherapy,
      label: labels.homePhysio,
    },
    { href: siteConfig.links.doctors, label: labels.onlineConsult },
    {
      href: siteConfig.links.sundayConsult,
      label: labels.sundayConsult,
      badge: labels.freeBadge,
    },
    {
      href: siteConfig.links.urgentCare,
      label: labels.urgentCare,
      badge: labels.urgentBadge,
    },
  ];

  const accountSection = buildAccountMobileSection(session, {
    myDashboard: labels.myDashboard,
    patientDashboard: labels.patientDashboard,
    doctorDashboard: labels.doctorDashboard,
    adminDashboard: labels.adminDashboard,
    healthAssistant: labels.healthAssistant,
    signOut: labels.signOut,
    login: labels.login,
    createAccount: labels.createAccount,
  });

  return {
    links,
    sections: accountSection ? [accountSection] : [],
  };
}
