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
    patientDashboard: t.dashboard.header.patientDashboard,
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
            className="hidden min-w-0 flex-1 items-center justify-center gap-0 px-0.5 text-xs font-medium text-slate-600 lg:flex xl:gap-0.5 xl:px-1 xl:text-[13px] 2xl:gap-1 2xl:px-2 2xl:text-sm"
            aria-label="Main"
          >
            {resolvedNavLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-2 transition-colors hover:bg-brand-muted hover:text-brand-dark xl:px-2 2xl:gap-1.5 2xl:px-3"
              >
                {item.label}
                {item.badge ? (
                  <span className="rounded-md bg-brand px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white xl:px-1.5 xl:text-[10px]">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        ) : (
          <div className="hidden flex-1 lg:block" aria-hidden />
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
              className={resolvedNavLinks.length > 0 ? "lg:hidden" : undefined}
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
