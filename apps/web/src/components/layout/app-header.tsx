import Link from "next/link";
import { SiteLogo } from "@/components/layout/site-logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { appHeaderInner, appHeaderShell } from "@/lib/ui/surfaces";

export type AppNavLink = {
  href: string;
  label: string;
};

type AppHeaderProps = {
  links: AppNavLink[];
};

export function AppHeader({ links }: AppHeaderProps) {
  return (
    <header className={appHeaderShell}>
      <div className={appHeaderInner}>
        <SiteLogo
          size="lg"
          className="shrink-0 max-sm:[&_img]:h-12 max-sm:[&_img]:min-w-[7.5rem]"
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
        </nav>

        <MobileNav links={links} className="ml-auto md:hidden" />
      </div>
    </header>
  );
}
