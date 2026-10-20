"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Mail,
  MapPin,
  MessageCircle,
  Shield,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { SiteLogo } from "@/components/layout/site-logo";
import { SocialLinks } from "@/components/shared/social-links";
import { getWhatsAppSupportUrl } from "@/lib/support-contact";
import { providerDirectoryLinks } from "@/lib/nav/provider-directories";
import { AppDownloadBanner } from "@/components/pwa/app-download-banner";
import { useOptionalLocale, useTranslations } from "@/i18n/locale-provider";
import { ABOUT_NAV_LABEL } from "@/features/about/nav";

type FooterLinkItem = {
  href: string;
  label: string;
  badge?: string;
};

type FooterGroup = {
  title: string;
  links: readonly FooterLinkItem[];
};

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white">
      <span className="h-px w-4 bg-gradient-to-r from-brand-lighter to-brand" aria-hidden />
      {children}
    </h3>
  );
}

function FooterColumn({ groups }: { groups: readonly FooterGroup[] }) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.title}>
          <FooterHeading>{group.title}</FooterHeading>
          <ul className="mt-4 space-y-0.5">
            {group.links.map((link) => (
              <li key={link.href + link.label}>
                <FooterLink {...link} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FooterLink({ href, label, badge }: FooterLinkItem) {
  return (
    <Link
      href={href}
      className="group flex min-h-9 items-center gap-2 py-1.5 text-sm text-slate-400 transition-colors hover:text-white"
    >
      <span
        className="h-px w-0 shrink-0 bg-brand-lighter transition-all duration-300 group-hover:w-3"
        aria-hidden
      />
      <span className="min-w-0 leading-snug">{label}</span>
      {badge ? (
        <span className="shrink-0 rounded-full border border-brand/40 bg-brand/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-brand-lighter">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function SiteFooter() {
  const t = useTranslations();
  const locale = useOptionalLocale();

  const serviceLinks: FooterLinkItem[] = [
    { href: siteConfig.links.doctors, label: t.nav.onlineConsult },
    { href: siteConfig.links.sundayConsult, label: t.nav.sundayConsult, badge: t.nav.freeBadge },
    { href: siteConfig.links.urgentCare, label: t.nav.urgentCare, badge: t.nav.urgentBadge },
    { href: siteConfig.links.homeServices, label: t.nav.homeServices },
    { href: siteConfig.links.homeCareRequest, label: t.homeCare.bookVisit },
  ];

  const findProviderLinks: FooterLinkItem[] = providerDirectoryLinks(t.nav).map(({ href, label }) => ({
    href,
    label,
  }));

  const providerLinks: FooterLinkItem[] = [
    { href: siteConfig.links.forDoctors, label: t.providerOnboarding.doctor.eyebrow },
    { href: siteConfig.links.forDoctorsGuide, label: t.breadcrumbs.doctorGuide },
    { href: siteConfig.links.forNurses, label: t.providerOnboarding.nurse.eyebrow },
    { href: siteConfig.links.forPhysiotherapists, label: t.providerOnboarding.physiotherapist.eyebrow },
    { href: siteConfig.links.forPhysiotherapistsGuide, label: t.breadcrumbs.physioGuide },
  ];

  const joinLinks: FooterLinkItem[] = [
    { href: siteConfig.links.registerDoctor, label: t.auth.registerDoctor },
    { href: siteConfig.links.registerNurse, label: t.auth.registerNurse },
    { href: siteConfig.links.registerPhysiotherapist, label: t.auth.registerPhysiotherapist },
    { href: siteConfig.links.registerHerbalist, label: t.auth.registerHerbalist },
    { href: siteConfig.links.registerNutritionist, label: t.auth.registerNutritionist },
  ];

  const accountLinks: FooterLinkItem[] = [
    { href: siteConfig.links.login, label: t.auth.login },
    { href: siteConfig.links.register, label: t.auth.register },
  ];

  const getAppLinks: FooterLinkItem[] = [
    { href: siteConfig.links.getApp, label: t.footer.getApp },
    { href: siteConfig.links.getAppAndroid, label: t.footer.getAppAndroid },
    { href: siteConfig.links.getAppIos, label: t.footer.getAppIos },
  ];

  const legalLinks: FooterLinkItem[] = [
    { href: siteConfig.links.about, label: ABOUT_NAV_LABEL[locale] },
    { href: siteConfig.links.legal, label: t.legal.company.navLabel },
    { href: siteConfig.links.terms, label: t.legal.pages.terms },
    { href: siteConfig.links.privacy, label: t.legal.pages.privacy },
    { href: siteConfig.links.telemedicineConsent, label: t.legal.pages.telemedicineConsent },
    { href: siteConfig.links.refundPolicy, label: t.legal.pages.refundPolicy },
  ];

  return (
    <>
      <AppDownloadBanner />
      <footer className="relative isolate overflow-hidden bg-[#03112a] text-slate-300">
        {/* Ambient glow + top hairline */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-lighter/60 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-40 start-1/2 -z-10 h-80 w-[60rem] max-w-[150vw] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl rtl:translate-x-1/2"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -end-40 -z-10 h-96 w-96 rounded-full bg-[#1e4fa8]/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]"
          aria-hidden
        />

        <div className="mx-auto w-full max-w-[100rem] px-4 sm:px-8 lg:px-14">
          {/* CTA band */}
          <div className="pt-12 sm:pt-16">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand/25 via-[#072b5e] to-[#051e42] p-6 shadow-2xl shadow-black/30 sm:p-10">
              <div
                className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-brand-lighter/20 blur-3xl"
                aria-hidden
              />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {t.footer.ctaTitle}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                    {t.footer.ctaDescription}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                  <Link
                    href={siteConfig.links.register}
                    className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#03112a] shadow-lg shadow-brand/20 transition hover:bg-brand-lighter"
                  >
                    {t.footer.ctaPrimary}
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                  <Link
                    href={siteConfig.links.sundayConsult}
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur transition hover:border-white/40 hover:bg-white/10"
                  >
                    {t.footer.ctaSecondary}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="grid gap-12 py-14 sm:py-16 lg:grid-cols-12 lg:gap-10">
            <div className="space-y-7 lg:col-span-4">
              <SiteLogo size="lg" className="-ms-0.5" />

              <p className="max-w-sm text-sm leading-relaxed text-slate-400">{t.site.description}</p>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand-lighter">
                  <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.footer.pmdcBadge}
                </span>
                <Link
                  href={siteConfig.links.legal}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:border-emerald-300/60"
                >
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.footer.secpBadge}
                </Link>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-lighter" aria-hidden />
                  {t.site.launchNote}
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur">
                <p className="px-3 pb-1 pt-2.5 text-sm font-semibold text-white">{t.footer.contactSupport}</p>
                <p className="px-3 pb-2.5 text-xs leading-relaxed text-slate-400">
                  {t.footer.contactWhatsAppHint}
                </p>
                <a
                  href={getWhatsAppSupportUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-900/40">
                    <MessageCircle className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-slate-400">{t.footer.contactWhatsApp}</span>
                    <span className="block text-sm font-medium text-white" dir="ltr">
                      {siteConfig.supportWhatsAppDisplay}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-white rtl:rotate-180"
                    aria-hidden
                  />
                </a>
                <a
                  href={`mailto:${siteConfig.supportEmail}`}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-lighter to-brand text-white shadow-md shadow-brand/30">
                    <Mail className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-slate-400">{t.footer.contactSupport}</span>
                    <span className="block truncate text-sm font-medium text-white">
                      {siteConfig.supportEmail}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-white rtl:rotate-180"
                    aria-hidden
                  />
                </a>
              </div>

              <div className="space-y-3">
                <FooterHeading>{t.footer.followUs}</FooterHeading>
                <SocialLinks />
              </div>
            </div>

            <div className="grid gap-10 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3 lg:gap-x-8">
              <FooterColumn groups={[{ title: t.footer.services, links: serviceLinks }]} />
              <FooterColumn groups={[{ title: t.nav.findProvider, links: findProviderLinks }]} />
              <FooterColumn groups={[{ title: t.footer.providers, links: providerLinks }]} />
              <FooterColumn groups={[{ title: t.footer.joinUs, links: joinLinks }]} />
              <FooterColumn
                groups={[
                  { title: t.footer.account, links: accountLinks },
                  { title: t.footer.getApp, links: getAppLinks },
                ]}
              />
              <FooterColumn groups={[{ title: t.footer.legal, links: legalLinks }]} />
            </div>
          </div>

          {/* Emergency notice */}
          <div className="mb-10 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-500/10 to-transparent px-4 py-4 sm:items-center sm:px-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30">
              <AlertTriangle className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
            </span>
            <p className="text-xs leading-relaxed text-amber-100/80 sm:text-sm">
              <span className="font-semibold text-amber-100">{t.footer.emergencyTitle}.</span>{" "}
              {t.footer.emergencyDescription}
            </p>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pb-10 pt-8 pb-safe text-center text-xs text-slate-500 sm:flex-row sm:pb-12 sm:text-start">
            <div className="space-y-1">
              <p>
                © <span suppressHydrationWarning>{new Date().getFullYear()}</span>{" "}
                {siteConfig.company.legalName}. {t.site.rights}
              </p>
              <p>
                {t.footer.secpLine}{" "}
                <Link
                  href={siteConfig.links.legal}
                  className="font-mono text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-brand-lighter"
                >
                  {siteConfig.company.cuin}
                </Link>
              </p>
            </div>
            <p className="text-sm text-slate-400">
              {t.footer.productOfBefore}
              {t.footer.productOfBefore ? " " : null}
              <Link
                href="https://techcognify.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-200 underline decoration-white/20 underline-offset-2 hover:text-brand-lighter"
              >
                {t.footer.productOfCompany}
              </Link>
              {t.footer.productOfAfter ? ` ${t.footer.productOfAfter}` : null}
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
