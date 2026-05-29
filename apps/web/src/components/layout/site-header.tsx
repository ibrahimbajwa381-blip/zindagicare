import Link from "next/link";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { SiteLogo } from "@/components/layout/site-logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { appHeaderInner, appHeaderShell } from "@/lib/ui/surfaces";

const nav = siteConfig.nav.main;

export function SiteHeader() {
  return (
    <header className={appHeaderShell}>
      <div className={cn(appHeaderInner, "justify-between gap-3 text-slate-600")}>
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

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
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

          <Button
            size="sm"
            className="rounded-lg bg-brand shadow-sm shadow-brand/25 hover:bg-brand-dark sm:hidden"
            asChild
          >
            <Link href={siteConfig.links.register}>Get started</Link>
          </Button>

          <MobileNav
            links={nav}
            footer={
              <>
                <Button variant="outline" size="lg" className="h-12 w-full rounded-xl" asChild>
                  <Link href={siteConfig.links.login}>Log in</Link>
                </Button>
                <Button
                  size="lg"
                  className="h-12 w-full rounded-xl bg-brand shadow-sm hover:bg-brand-dark"
                  asChild
                >
                  <Link href={siteConfig.links.register}>Create account</Link>
                </Button>
              </>
            }
          />
        </div>
      </div>
    </header>
  );
}
