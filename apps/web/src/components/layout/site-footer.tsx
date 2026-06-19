"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarHeart,
  FileText,
  HeartPulse,
  Home,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  RotateCcw,
  Scale,
  Shield,
  Stethoscope,
  UserPlus,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { SiteLogo } from "@/components/layout/site-logo";
import { getWhatsAppSupportUrl } from "@/lib/support-contact";
import { formatMessage } from "@/i18n/messages";
import { useTranslations } from "@/i18n/locale-provider";

type FooterLinkItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  external?: boolean;
};

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly FooterLinkItem[];
}) {
  return (
    <div>
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-brand-lighter/90">
        {title}
      </p>
      <ul className="mt-4 space-y-1.5">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <FooterLink {...link} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterLink({ href, label, icon: Icon, badge, external }: FooterLinkItem) {
  const className = cn(
    "group flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-white/75 transition-colors duration-200",
    "hover:bg-white/8 hover:text-white",
    "motion-safe:hover:pl-3.5",
  );

  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/8 text-brand-lighter transition-colors group-hover:bg-brand/25 group-hover:text-white">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
      {badge ? (
        <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white">
          {badge}
        </span>
      ) : null}
      <ArrowUpRight
        className="h-3.5 w-3.5 shrink-0 text-white/0 transition-all duration-200 group-hover:text-brand-lighter/80"
        aria-hidden
      />
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export function SiteFooter() {
  const t = useTranslations();

  const serviceLinks: FooterLinkItem[] = [
    { href: siteConfig.links.doctors, label: t.nav.onlineConsult, icon: Video },
    {
      href: siteConfig.links.sundayConsult,
      label: t.nav.sundayConsult,
      icon: CalendarHeart,
      badge: t.nav.freeBadge,
    },
    {
      href: siteConfig.links.urgentCare,
      label: t.nav.urgentCare,
      icon: Zap,
      badge: t.nav.urgentBadge,
    },
    { href: siteConfig.links.homeServices, label: t.nav.homeServices, icon: Home },
    {
      href: siteConfig.links.homeCareRequest,
      label: t.homeCare.bookVisit,
      icon: HeartPulse,
    },
  ];

  const providerLinks: FooterLinkItem[] = [
    { href: siteConfig.links.forDoctors, label: t.providerOnboarding.doctor.eyebrow, icon: Stethoscope },
    { href: siteConfig.links.forNurses, label: t.providerOnboarding.nurse.eyebrow, icon: HeartPulse },
    { href: siteConfig.links.registerDoctor, label: t.auth.registerDoctor, icon: UserPlus },
    { href: siteConfig.links.registerNurse, label: t.auth.registerNurse, icon: UserPlus },
  ];

  const accountLinks: FooterLinkItem[] = [
    { href: siteConfig.links.login, label: t.auth.login, icon: LogIn },
    { href: siteConfig.links.register, label: t.auth.register, icon: UserPlus },
  ];

  const legalLinks: FooterLinkItem[] = [
    { href: siteConfig.links.terms, label: t.legal.pages.terms, icon: Scale },
    { href: siteConfig.links.privacy, label: t.legal.pages.privacy, icon: Shield },
    {
      href: siteConfig.links.telemedicineConsent,
      label: t.legal.pages.telemedicineConsent,
      icon: FileText,
    },
    { href: siteConfig.links.refundPolicy, label: t.legal.pages.refundPolicy, icon: RotateCcw },
  ];

  return (
    <footer className="relative border-t border-accent-dark/40 bg-gradient-to-br from-[#061f4a] via-accent-dark to-[#041530] text-white/80">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-mesh-footer" />
      <div
        aria-hidden
        className="relative h-1 w-full bg-gradient-to-r from-brand via-brand-light to-brand-lighter"
      />

      <div className="relative isolate z-10 mx-auto w-full max-w-[100rem] px-4 sm:px-8 lg:px-14">
        {/* CTA band */}
        <div className="border-b border-white/10 py-8 sm:py-10">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-white/10 bg-[#0a2559]/90 p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="max-w-xl">
              <p className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                {t.footer.ctaTitle}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/60 sm:text-base">
                {t.footer.ctaDescription}
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                href={siteConfig.links.register}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand-light hover:shadow-brand/35"
              >
                {t.footer.ctaPrimary}
              </Link>
              <Link
                href={siteConfig.links.sundayConsult}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white transition-all hover:border-brand-lighter/40 hover:bg-white/10"
              >
                {t.footer.ctaSecondary}
              </Link>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-10 py-12 sm:gap-12 lg:grid-cols-12 lg:py-16">
          <div className="lg:col-span-4">
            <SiteLogo size="lg" className="-ml-0.5" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
              {t.site.description}
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-brand/35 bg-[#0d365f] px-3 py-1.5 text-xs font-semibold leading-snug text-brand-lighter antialiased">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                {t.footer.pmdcBadge}
              </span>
              <span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-white/20 bg-[#0a2559] px-3 py-1.5 text-xs font-medium leading-snug text-white/90 antialiased">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-lighter" />
                {formatMessage(t.site.launchNote, { city: siteConfig.launchCity })}
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <a
                href={getWhatsAppSupportUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-white/75 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-white"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-200">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs text-white/45">{t.footer.contactWhatsApp}</span>
                  <span className="font-medium text-white/90">{siteConfig.supportWhatsAppDisplay}</span>
                </span>
              </a>
              <p className="text-xs leading-relaxed text-white/50">{t.footer.contactWhatsAppHint}</p>
              <a
                href={`mailto:${siteConfig.supportEmail}`}
                className="inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 transition-colors hover:border-brand/30 hover:bg-white/8 hover:text-white"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/20 text-brand-lighter">
                  <Mail className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs text-white/45">{t.footer.contactSupport}</span>
                  <span className="font-medium text-white/90">{siteConfig.supportEmail}</span>
                </span>
              </a>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4 lg:gap-6">
            <FooterColumn title={t.footer.services} links={serviceLinks} />
            <FooterColumn title={t.footer.providers} links={providerLinks} />
            <FooterColumn title={t.footer.account} links={accountLinks} />
            <FooterColumn title={t.footer.legal} links={legalLinks} />
          </div>
        </div>

        {/* Emergency notice */}
        <div className="mb-10 flex gap-3 rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-500/10 to-amber-500/5 px-4 py-4 sm:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
            <AlertTriangle className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-100">{t.footer.emergencyTitle}</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/70 sm:text-sm">
              {t.footer.emergencyDescription}
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="space-y-5 border-t border-white/10 pb-10 pt-8 pb-safe sm:pb-12">
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/65 transition-colors hover:border-brand/30 hover:bg-brand/15 hover:text-brand-lighter"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-col items-center justify-between gap-4 text-center text-xs text-white/45 sm:flex-row sm:text-left">
            <p>
              © <span suppressHydrationWarning>{new Date().getFullYear()}</span> {t.site.name}.{" "}
              {t.site.rights}
            </p>
            <p className="text-sm text-white/60">
              {t.footer.productOfBefore}
              {t.footer.productOfBefore ? " " : null}
              <Link
                href="https://techcognify.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white/85 underline decoration-white/25 underline-offset-2 transition-colors hover:text-brand-lighter hover:decoration-brand-lighter"
              >
                {t.footer.productOfCompany}
              </Link>
              {t.footer.productOfAfter ? ` ${t.footer.productOfAfter}` : null}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
