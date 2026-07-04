"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
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
import { useTranslations } from "@/i18n/locale-provider";

export type UnifiedNavLink = {
  href: string;
  label: string;
  badge?: string;
};

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
    urgentCare: t.nav.urgentCare,
    homeServices: t.nav.homeServices,
    homePhysio: t.nav.homePhysio,
    freeBadge: t.nav.freeBadge,
    urgentBadge: t.nav.urgentBadge,
    myDashboard: t.dashboard.header.myDashboard,
    doctorDashboard: t.dashboard.header.doctorDashboard,
    adminDashboard: t.dashboard.header.adminDashboard,
    healthAssistant: t.copilot.navLabel,
    signOut: t.dashboard.header.signOut,
    login: t.auth.login,
    createAccount: t.auth.createAccount,
  });

  const defaultNavLinks: readonly UnifiedNavLink[] = [
    { label: t.nav.homeServices, href: siteConfig.links.homeServices },
    {
      label: t.nav.homePhysio,
      href: siteConfig.links.homePhysiotherapy,
    },
    { label: t.nav.onlineConsult, href: siteConfig.links.doctors },
    {
      label: t.nav.sundayConsult,
      href: siteConfig.links.sundayConsult,
      badge: t.nav.freeBadge,
    },
    {
      label: t.nav.urgentCare,
      href: siteConfig.links.urgentCare,
      badge: t.nav.urgentBadge,
    },
  ];

  const resolvedNavLinks = navLinks ?? defaultNavLinks;
  const resolvedMobileLinks = mobileLinks ?? marketingMobile.links;
  const resolvedMobileSections = mobileSections ?? marketingMobile.sections;

  return (
    <header
      className={cn(
        appHeaderShell,
        hidden &&
          "max-md:translate-y-0 md:transition-transform md:duration-300 md:ease-in-out md:motion-reduce:transition-none md:-translate-y-full",
      )}
    >
      <div className={cn(appHeaderInner, "justify-between gap-2 text-slate-600")}>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {leadingSlot}
          <SiteLogo
            size="md"
            className="group min-w-0 shrink-0 font-semibold text-foreground sm:hidden"
            priority
          />
          <SiteLogo
            size="lg"
            className="group hidden min-w-0 shrink-0 font-semibold text-foreground sm:inline-flex"
            priority
          />
        </div>

        {resolvedNavLinks.length > 0 ? (
          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-1 px-2 text-sm font-medium text-slate-600 lg:flex"
            aria-label="Main"
          >
            {resolvedNavLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors hover:bg-brand-muted hover:text-brand-dark"
              >
                {item.label}
                {item.badge ? (
                  <span className="rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        ) : (
          <div className="hidden flex-1 lg:block" aria-hidden />
        )}

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-1 md:flex">
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
            {showMobileNav ? (
              <MobileNav
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
      </div>
    </header>
  );
}
