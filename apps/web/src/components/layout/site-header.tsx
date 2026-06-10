"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { SiteLogo } from "@/components/layout/site-logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { AppHeaderUser } from "@/components/layout/app-header-user";
import { HeaderAuthActions } from "@/components/layout/header-auth-actions";
import { appHeaderInner, appHeaderShell } from "@/lib/ui/surfaces";
import { buildMarketingMobileNav } from "@/lib/nav/mobile-menu";
import { useTranslations } from "@/i18n/locale-provider";

type SiteHeaderProps = {
  /** Load patient city/phone in the account menu (patient dashboard). */
  enrichUserFromProfile?: boolean;
};

export function SiteHeader({ enrichUserFromProfile = false }: SiteHeaderProps) {
  const t = useTranslations();
  const { data: session } = useSession();

  const { links: mobileLinks, sections: mobileSections } = buildMarketingMobileNav(session, {
    home: t.nav.home,
    onlineConsult: t.nav.onlineConsult,
    sundayConsult: t.nav.sundayConsult,
    homeServices: t.nav.homeServices,
    freeBadge: t.nav.freeBadge,
    myDashboard: t.dashboard.header.myDashboard,
    signOut: t.dashboard.header.signOut,
    login: t.auth.login,
    createAccount: t.auth.createAccount,
  });

  const nav = [
    { label: t.nav.onlineConsult, href: siteConfig.links.doctors },
    {
      label: t.nav.sundayConsult,
      href: siteConfig.links.sundayConsult,
      badge: t.nav.freeBadge,
    },
    { label: t.nav.homeServices, href: siteConfig.links.homeServices },
  ] as const;

  return (
    <header className={appHeaderShell}>
      <div className={cn(appHeaderInner, "justify-between gap-2 text-slate-600")}>
        <SiteLogo
          size="lg"
          className="group -my-1 min-w-0 shrink font-semibold text-foreground transition-transform group-hover:scale-[1.02] max-sm:[&_img]:h-12 max-sm:[&_img]:min-w-[7.5rem]"
          priority
        />

        <nav
          className="hidden items-center gap-1 text-sm font-medium text-slate-600 md:flex"
          aria-label="Main"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors hover:bg-brand-muted hover:text-brand-dark"
            >
              {item.label}
              {"badge" in item && item.badge && (
                <span className="rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="hidden h-10 shrink-0 items-center gap-2 md:flex">
          <LanguageSwitcher variant="compact" size="header" />
          {session?.user ? (
            <AppHeaderUser enrichFromProfile={enrichUserFromProfile} />
          ) : (
            <HeaderAuthActions
              layout="desktop"
              loginLabel={t.auth.login}
              getStartedLabel={t.auth.getStarted}
              createAccountLabel={t.auth.createAccount}
            />
          )}
        </div>

        <MobileNav
          links={mobileLinks}
          sections={mobileSections}
          menuLabel={t.common.menu}
          openMenuLabel={t.common.openMenu}
          closeMenuLabel={t.common.closeMenu}
          footer={<LanguageSwitcher className="w-full justify-center" size="header" />}
        />
      </div>
    </header>
  );
}
