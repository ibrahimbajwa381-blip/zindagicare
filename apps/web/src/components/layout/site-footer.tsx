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
      <div className="mx-auto w-full max-w-[100rem] px-4 py-12 pb-safe sm:px-8 sm:py-16 lg:px-14">
        <div className="grid gap-10 sm:gap-12 md:grid-cols-4">
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
            <ul className="mt-4 space-y-1 text-sm sm:space-y-3">
              <li>
                <Link
                  href={siteConfig.links.doctors}
                  className="inline-flex min-h-11 items-center py-1 transition-colors hover:text-brand-lighter hover:underline-offset-2 hover:underline sm:min-h-0 sm:py-0"
                >
                  Online consultation
                </Link>
              </li>
              <li>
                <Link
                  href={siteConfig.links.sundayConsult}
                  className="inline-flex min-h-11 items-center py-1 transition-colors hover:text-brand-lighter hover:underline-offset-2 hover:underline sm:min-h-0 sm:py-0"
                >
                  Sunday Free Consult
                </Link>
              </li>
              <li>
                <Link
                  href={siteConfig.links.homeServices}
                  className="inline-flex min-h-11 items-center py-1 transition-colors hover:text-brand-lighter hover:underline-offset-2 hover:underline sm:min-h-0 sm:py-0"
                >
                  In-house medical services
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
              Account
            </p>
            <ul className="mt-4 space-y-1 text-sm sm:space-y-3">
              <li>
                <Link
                  href={siteConfig.links.login}
                  className="inline-flex min-h-11 items-center py-1 transition-colors hover:text-brand-lighter hover:underline-offset-2 hover:underline sm:min-h-0 sm:py-0"
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  href={siteConfig.links.register}
                  className="inline-flex min-h-11 items-center py-1 transition-colors hover:text-brand-lighter hover:underline-offset-2 hover:underline sm:min-h-0 sm:py-0"
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
