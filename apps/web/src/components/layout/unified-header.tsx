"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { SiteLogo } from "@/components/layout/site-logo";
import { MobileNav, type MobileNavSection } from "@/components/layout/mobile-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { AppHeaderUser } from "@/components/layout/app-header-user";
import { HeaderAuthActions } from "@/components/layout/header-auth-actions";
import { HeaderChatButton } from "@/components/layout/header-chat-button";
import { HeaderAssistantButton } from "@/components/layout/header-assistant-button";
import { HeaderNotificationsMenu } from "@/components/layout/header-notifications-menu";
import { useHeaderBadges } from "@/components/layout/use-header-badges";
import { useHideOnScroll } from "@/components/layout/use-hide-on-scroll";
import { appHeaderInner, appHeaderShell } from "@/lib/ui/surfaces";
import { buildMarketingMobileNav } from "@/lib/nav/mobile-menu";
import { providerDirectoryLinks } from "@/lib/nav/provider-directories";
import { useTranslations } from "@/i18n/locale-provider";

type NavBadge = { badge?: string };

export type UnifiedNavLink = NavBadge &
  (
    | {
        href: string;
        label: string;
        /** Desktop dropdown items; the parent link stays clickable. */
        children?: readonly UnifiedNavLink[];
      }
    | {
        /** Menu-only parent (e.g. "More"): opens its dropdown, links nowhere itself. */
        href?: undefined;
        label: string;
        children: readonly UnifiedNavLink[];
      }
  );

type UnifiedHeaderProps = {
  /** Primary navigation links shown on desktop. */
  navLinks?: readonly UnifiedNavLink[];
  /** Custom mobile navigation; defaults to marketing nav when omitted. */
  mobileLinks?: readonly UnifiedNavLink[];
  mobileSections?: readonly MobileNavSection[];
  /** Show phone/city from patient profile in the account menu. */
  enrichUserFromProfile?: boolean;
  /** Optional slot before the logo (e.g. workspace sidebar toggle). */
  leadingSlot?: ReactNode;
  /** Hide the marketing mobile drawer when using a workspace sidebar. */
  showMobileNav?: boolean;
  menuLabel?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
};

export function UnifiedHeader({
  navLinks,
  mobileLinks,
  mobileSections,
  enrichUserFromProfile = false,
  leadingSlot,
  showMobileNav = true,
  menuLabel,
  openMenuLabel,
  closeMenuLabel,
}: UnifiedHeaderProps) {
  const t = useTranslations();
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const { chatUnread, notificationUnread, refresh } = useHeaderBadges(isLoggedIn);
  const hidden = useHideOnScroll();

  const marketingMobile = buildMarketingMobileNav(session, {
    home: t.nav.home,
    onlineConsult: t.nav.onlineConsult,
    sundayConsult: t.nav.sundayConsult,
    askDoctor: t.nav.askDoctor,
    urgentCare: t.nav.urgentCare,
    homeServices: t.nav.homeServices,
    homePhysio: t.nav.homePhysio,
    freeBadge: t.nav.freeBadge,
    urgentBadge: t.nav.urgentBadge,
    myDashboard: t.dashboard.header.myDashboard,
    patientDashboard: t.dashboard.header.patientDashboard,
    doctorDashboard: t.dashboard.header.doctorDashboard,
    adminDashboard: t.dashboard.header.adminDashboard,
    healthAssistant: t.copilot.navLabel,
    prescriptions: t.prescriptions.title,
    signOut: t.dashboard.header.signOut,
    login: t.auth.login,
    createAccount: t.auth.createAccount,
    findProvider: t.nav.findProvider,
    doctors: t.nav.doctors,
    nurses: t.nav.nurses,
    physiotherapists: t.nav.physiotherapists,
    herbalists: t.nav.herbalists,
    nutritionists: t.nav.nutritionists,
  });

  const defaultNavLinks: readonly UnifiedNavLink[] = [
    {
      label: t.nav.findProvider,
      href: siteConfig.links.doctors,
      children: providerDirectoryLinks(t.nav),
    },
    { label: t.nav.homeServices, href: siteConfig.links.homeServices },
    {
      label: t.nav.askDoctor,
      href: siteConfig.links.askDoctor,
      badge: t.nav.freeBadge,
    },
    {
      label: t.nav.urgentCare,
      href: siteConfig.links.urgentCare,
      badge: t.nav.urgentBadge,
    },
    // Seven top-level links overflow the header at every width, so the rest sit under "More".
    {
      label: t.nav.more,
      children: [
        { label: t.nav.homePhysio, href: siteConfig.links.homePhysiotherapy },
        { label: t.nav.onlineConsult, href: siteConfig.links.doctors },
        {
          label: t.nav.sundayConsult,
          href: siteConfig.links.sundayConsult,
          badge: t.nav.freeBadge,
        },
      ],
    },
  ];

  const resolvedNavLinks = navLinks ?? defaultNavLinks;
  const resolvedMobileLinks = mobileLinks ?? marketingMobile.links;
  const resolvedMobileSections = mobileSections ?? marketingMobile.sections;

  return (
    <header
      dir="ltr"
      className={cn(
        appHeaderShell,
        hidden &&
          "max-md:translate-y-0 md:pointer-events-none md:-translate-y-full md:transition-transform md:duration-300 md:ease-in-out md:motion-reduce:transition-none",
      )}
    >
      <div
        className={cn(
          appHeaderInner,
          "justify-between gap-2 text-slate-600 lg:gap-2 lg:px-5 xl:gap-4 xl:px-10 2xl:gap-6 2xl:px-14",
        )}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {leadingSlot}
          <SiteLogo
            size="md"
            className="group min-w-0 shrink-0 font-semibold text-foreground sm:hidden"
            priority
          />
          <SiteLogo
            size="lg"
            className="group hidden min-w-0 shrink-0 font-semibold text-foreground sm:inline-flex [&_img]:md:h-12 [&_img]:md:max-w-[9rem] [&_img]:xl:h-14 [&_img]:xl:max-w-[10rem] [&_img]:2xl:h-16 [&_img]:2xl:max-w-[11rem]"
            priority
          />
        </div>

        {resolvedNavLinks.length > 0 ? (
          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-0 px-0.5 text-xs font-medium text-slate-600 xl:flex xl:gap-0.5 xl:px-1 xl:text-[13px] 2xl:gap-1 2xl:px-2 2xl:text-sm"
            aria-label="Main"
          >
            {resolvedNavLinks.map((item) => {
              const linkClass =
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-2 transition-colors hover:bg-brand-muted hover:text-brand-dark xl:px-2 2xl:gap-1.5 2xl:px-3";
              const linkContent = (
                <>
                  {item.label}
                  {item.children ? <ChevronDown className="h-3 w-3" aria-hidden /> : null}
                  {item.badge ? <NavBadgePill label={item.badge} /> : null}
                </>
              );
              const link = item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-haspopup={item.children ? "true" : undefined}
                  className={linkClass}
                >
                  {linkContent}
                </Link>
              ) : (
                <button key={item.label} type="button" aria-haspopup="true" className={linkClass}>
                  {linkContent}
                </button>
              );
              if (!item.children) return link;
              // Opens on hover and on keyboard focus (focus-within), no JS state needed.
              return (
                <div key={item.label} className="group relative">
                  {link}
                  <div className="invisible absolute left-0 top-full z-50 pt-1 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <ul className="min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                      {item.children.map((child) => (
                        <li key={child.label}>
                          <Link
                            href={child.href ?? "#"}
                            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-brand-muted hover:text-brand-dark"
                          >
                            {child.label}
                            {child.badge ? <NavBadgePill label={child.badge} /> : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </nav>
        ) : (
          <div className="hidden flex-1 xl:block" aria-hidden />
        )}

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <div className="hidden items-center gap-1 whitespace-nowrap md:flex">
            <LanguageSwitcher variant="compact" size="header" />
            {isLoggedIn ? (
              <>
                <HeaderAssistantButton label={t.header.actions.assistant} />
                <HeaderChatButton count={chatUnread} label={t.header.actions.messages} />
                <HeaderNotificationsMenu
                  count={notificationUnread}
                  onCountChange={() => void refresh()}
                />
                <AppHeaderUser enrichFromProfile={enrichUserFromProfile} />
              </>
            ) : (
              <HeaderAuthActions
                layout="desktop"
                loginLabel={t.auth.login}
                getStartedLabel={t.auth.getStarted}
                createAccountLabel={t.auth.createAccount}
              />
            )}
          </div>

          <div className="flex items-center gap-1 md:hidden">
            {isLoggedIn ? (
              <>
                <HeaderAssistantButton label={t.header.actions.assistant} />
                <HeaderChatButton count={chatUnread} label={t.header.actions.messages} />
                <HeaderNotificationsMenu
                  count={notificationUnread}
                  onCountChange={() => void refresh()}
                />
              </>
            ) : null}
          </div>

          {showMobileNav ? (
            <MobileNav
              className={resolvedNavLinks.length > 0 ? "xl:hidden" : undefined}
              links={resolvedMobileLinks}
              sections={resolvedMobileSections}
              menuLabel={menuLabel ?? t.common.menu}
              openMenuLabel={openMenuLabel ?? t.common.openMenu}
              closeMenuLabel={closeMenuLabel ?? t.common.closeMenu}
              footer={<LanguageSwitcher className="w-full justify-center" size="header" />}
            />
          ) : null}

          {isLoggedIn ? (
            <AppHeaderUser enrichFromProfile={enrichUserFromProfile} className="md:hidden" />
          ) : null}
        </div>
      </div>
    </header>
  );
}

function NavBadgePill({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-brand px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white xl:px-1.5 xl:text-[10px]">
      {label}
    </span>
  );
}
