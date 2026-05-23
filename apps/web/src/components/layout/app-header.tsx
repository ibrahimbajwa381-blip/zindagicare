import Link from "next/link";
import { SiteLogo } from "@/components/layout/site-logo";
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
        <SiteLogo size="lg" />
        <nav className="flex flex-1 items-center gap-1">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 transition-colors hover:bg-brand-muted hover:text-brand-dark"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
