import Link from "next/link";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { SiteLogo } from "@/components/layout/site-logo";
import { appHeaderInner, appHeaderShell } from "@/lib/ui/surfaces";

const nav = [
  { label: "Find Doctors", href: siteConfig.links.doctors },
  {
    label: "Sunday Free Consult",
    href: siteConfig.links.sundayConsult,
    badge: "Free",
  },
  { label: "Home Services", href: siteConfig.links.homeServices },
];

export function SiteHeader() {
  return (
    <header className={appHeaderShell}>
      <div className={cn(appHeaderInner, "justify-between text-slate-600")}>
        <SiteLogo
          size="lg"
          className="group -my-1 font-semibold text-foreground transition-transform group-hover:scale-[1.02]"
          priority
        />
        <nav className="hidden items-center gap-1 text-sm font-medium text-slate-600 md:flex">
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="rounded-lg" asChild>
            <Link href={siteConfig.links.login}>Log in</Link>
          </Button>
          <Button
            size="sm"
            className="rounded-lg bg-brand shadow-sm shadow-brand/25 hover:bg-brand-dark"
            asChild
          >
            <Link href={siteConfig.links.register}>Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
