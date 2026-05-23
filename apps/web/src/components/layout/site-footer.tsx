import Link from "next/link";
import { siteConfig } from "@/config/site";
import { SiteLogo } from "@/components/layout/site-logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-accent-dark/40 bg-gradient-to-br from-accent-dark via-accent to-[#082a66] text-white/80">
      <div
        aria-hidden
        className="h-1 w-full bg-gradient-to-r from-brand via-brand-light to-brand-lighter"
      />
      <div className="mx-auto w-full max-w-[100rem] px-5 py-16 sm:px-8 lg:px-14">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <SiteLogo size="xl" className="-ml-0.5" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
              {siteConfig.description}
            </p>
            <p className="mt-4 text-xs text-white/50">
              Launching in {siteConfig.launchCity}. PMDC-verified doctors only.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
              Services
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link
                  href={siteConfig.links.doctors}
                  className="transition-colors hover:text-brand-lighter hover:underline-offset-2 hover:underline"
                >
                  Find doctors
                </Link>
              </li>
              <li>
                <Link
                  href={siteConfig.links.sundayConsult}
                  className="transition-colors hover:text-brand-lighter hover:underline-offset-2 hover:underline"
                >
                  Sunday Free Consult
                </Link>
              </li>
              <li>
                <Link
                  href={siteConfig.links.homeServices}
                  className="transition-colors hover:text-brand-lighter hover:underline-offset-2 hover:underline"
                >
                  Home visits
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
              Account
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link
                  href={siteConfig.links.login}
                  className="transition-colors hover:text-brand-lighter hover:underline-offset-2 hover:underline"
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  href={siteConfig.links.register}
                  className="transition-colors hover:text-brand-lighter hover:underline-offset-2 hover:underline"
                >
                  Register
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-14 border-t border-white/10 pt-8 text-center text-xs text-white/45">
          © <span suppressHydrationWarning>{new Date().getFullYear()}</span>{" "}
          {siteConfig.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
