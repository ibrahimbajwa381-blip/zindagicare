"use client";

import Link from "next/link";
import {
  AlertTriangle,
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
  Smartphone,
  Stethoscope,
  UserPlus,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { SiteLogo } from "@/components/layout/site-logo";
import { getWhatsAppSupportUrl } from "@/lib/support-contact";
import { AppDownloadBanner } from "@/components/pwa/app-download-banner";
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
      <h3 className="text-xs font-bold uppercase tracking-widest text-brand-lighter">
        {title}
      </h3>
      <ul className="mt-4 space-y-1">
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
  const className =
    "flex min-h-10 items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white";

  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-brand-lighter" strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
      {badge ? (
        <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white">
          {badge}
        </span>
      ) : null}
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
    { href: siteConfig.links.forPhysiotherapists, label: t.providerOnboarding.physiotherapist.eyebrow, icon: HeartPulse },
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

  const getAppLinks: FooterLinkItem[] = [
    {
      href: siteConfig.links.getApp,
      label: t.footer.getApp,
      icon: Smartphone,
    },
    {
      href: siteConfig.links.getAppAndroid,
      label: t.footer.getAppAndroid,
      icon: Smartphone,
    },
    {
      href: siteConfig.links.getAppIos,
      label: t.footer.getAppIos,
      icon: Smartphone,
    },
  ];

  return (
    <>
      <AppDownloadBanner />
      <footer className="border-t border-white/10 bg-[#041530] text-slate-300">
      <div className="mx-auto w-full max-w-[100rem] px-4 sm:px-8 lg:px-14">
        <div className="grid gap-10 py-10 sm:gap-12 sm:py-14 lg:grid-cols-12 lg:py-16">
          <div className="space-y-6 lg:col-span-4">
            <SiteLogo size="lg" className="-ml-0.5" />

            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              {t.site.description}
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-[#062a5c] px-3 py-1.5 text-xs font-semibold text-brand-lighter">
                <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t.footer.pmdcBadge}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#062a5c] px-3 py-1.5 text-xs font-medium text-slate-200">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-lighter" aria-hidden />
                {formatMessage(t.site.launchNote, { city: siteConfig.launchCity })}
              </span>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#062a5c] p-4">
              <p className="text-sm font-semibold text-white">{t.footer.contactSupport}</p>
              <p className="text-xs leading-relaxed text-slate-400">
                {t.footer.contactWhatsAppHint}
              </p>

              <a
                href={getWhatsAppSupportUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-[#0a3d2e] px-4 py-3 text-sm text-white hover:border-emerald-400/50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-emerald-100">{t.footer.contactWhatsApp}</span>
                  <span className="block font-medium text-white">
                    {siteConfig.supportWhatsAppDisplay}
                  </span>
                </span>
              </a>

              <a
                href={`mailto:${siteConfig.supportEmail}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#051e42] px-4 py-3 text-sm text-white hover:border-brand/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
                  <Mail className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-slate-400">{t.footer.contactSupport}</span>
                  <span className="block font-medium text-white">{siteConfig.supportEmail}</span>
                </span>
              </a>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={siteConfig.links.register}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-light"
              >
                {t.footer.ctaPrimary}
              </Link>
              <Link
                href={siteConfig.links.sundayConsult}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-[#062a5c] px-5 text-sm font-semibold text-white hover:border-brand-lighter/40"
              >
                {t.footer.ctaSecondary}
              </Link>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-5 lg:gap-6">
            <FooterColumn title={t.footer.services} links={serviceLinks} />
            <FooterColumn title={t.footer.providers} links={providerLinks} />
            <FooterColumn title={t.footer.account} links={accountLinks} />
            <FooterColumn title={t.footer.getApp} links={getAppLinks} />
            <FooterColumn title={t.footer.legal} links={legalLinks} />
          </div>
        </div>

        <div className="mb-10 flex gap-3 rounded-2xl border border-amber-500/30 bg-[#2a1f08] px-4 py-4 sm:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600/20 text-amber-300">
            <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-100">{t.footer.emergencyTitle}</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/80 sm:text-sm">
              {t.footer.emergencyDescription}
            </p>
          </div>
        </div>

        <div className="space-y-5 border-t border-white/10 pb-10 pt-8 pb-safe sm:pb-12">
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/10 bg-[#062a5c] px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-brand/40 hover:text-brand-lighter"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-col items-center justify-between gap-4 text-center text-xs text-slate-500 sm:flex-row sm:text-left">
            <p>
              © <span suppressHydrationWarning>{new Date().getFullYear()}</span> {t.site.name}.{" "}
              {t.site.rights}
            </p>
            <p className="text-sm text-slate-400">
              {t.footer.productOfBefore}
              {t.footer.productOfBefore ? " " : null}
              <Link
                href="https://techcognify.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-200 underline decoration-white/30 underline-offset-2 hover:text-brand-lighter"
              >
                {t.footer.productOfCompany}
              </Link>
              {t.footer.productOfAfter ? ` ${t.footer.productOfAfter}` : null}
            </p>
          </div>
        </div>
      </div>
      </footer>
    </>
  );
}
