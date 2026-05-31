import Link from "next/link";
import { cn } from "@zindagi/shared";
import { SiteLogo } from "@/components/layout/site-logo";
import { MobileNav, type MobileNavSection } from "@/components/layout/mobile-nav";
import { AppHeaderUser } from "@/components/layout/app-header-user";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { appHeaderInner, appHeaderShell } from "@/lib/ui/surfaces";

export type AppNavLink = {
  href: string;
  label: string;
  badge?: string;
};

type AppHeaderProps = {
  links: AppNavLink[];
  sections?: MobileNavSection[];
  /** Show phone/city from patient profile in the account menu. */
  enrichUserFromProfile?: boolean;
  menuLabel?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
};

export function AppHeader({
  links,
  sections = [],
  enrichUserFromProfile,
  menuLabel = "Menu",
  openMenuLabel = "Open menu",
  closeMenuLabel = "Close menu",
}: AppHeaderProps) {
  return (
    <header className={appHeaderShell}>
      <div className={cn(appHeaderInner, "justify-between gap-2")}>
        <SiteLogo
          size="lg"
          className="min-w-0 shrink max-sm:[&_img]:h-12 max-sm:[&_img]:min-w-[7.5rem]"
        />

        <nav
          className="hidden min-w-0 flex-1 items-center justify-end gap-1 md:flex"
          aria-label="App"
        >
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm transition-colors hover:bg-brand-muted hover:text-brand-dark"
            >
              {item.label}
            </Link>
          ))}
          <LanguageSwitcher variant="compact" className="shrink-0" />
          <AppHeaderUser enrichFromProfile={enrichUserFromProfile} />
        </nav>

        <MobileNav
          links={links}
          sections={sections}
          menuLabel={menuLabel}
          openMenuLabel={openMenuLabel}
          closeMenuLabel={closeMenuLabel}
          footer={<LanguageSwitcher className="w-full justify-center" />}
        />
      </div>
    </header>
  );
}
