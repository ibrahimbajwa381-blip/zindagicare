"use client";

import Link from "next/link";
import { Gift, Lock, ShieldCheck, Star } from "lucide-react";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { useTranslations } from "@/i18n/locale-provider";

const itemAccents = [
  {
    iconBg: "from-brand-dark to-brand",
    glow: "bg-brand/10",
    bar: "from-brand-dark to-brand-light",
  },
  {
    iconBg: "from-accent to-accent-dark",
    glow: "bg-accent/10",
    bar: "from-accent to-accent-light",
  },
  {
    iconBg: "from-brand to-brand-light",
    glow: "bg-brand-light/15",
    bar: "from-brand to-brand-lighter",
  },
  {
    iconBg: "from-accent-light to-brand-light",
    glow: "bg-accent-light/15",
    bar: "from-accent-light to-brand-lighter",
  },
] as const;

export function TrustBar() {
  const t = useTranslations();

  const items = [
    {
      icon: ShieldCheck,
      label: t.trustBar.pmdcVerified,
      description: t.trustBar.pmdcVerifiedDesc,
      href: siteConfig.links.doctors,
    },
    {
      icon: Gift,
      label: t.trustBar.freeSunday,
      description: t.trustBar.freeSundayDesc,
      href: siteConfig.links.sundayConsult,
    },
    {
      icon: Lock,
      label: t.trustBar.secureVideo,
      description: t.trustBar.secureVideoDesc,
      href: siteConfig.links.doctors,
    },
    {
      icon: Star,
      label: t.trustBar.homeCare,
      description: t.trustBar.homeCareDesc,
      href: siteConfig.links.homeServices,
    },
  ];

  return (
    <PageSection variant="accent" spacing="default" flipBlur>
      <div className="rounded-2xl border border-white/70 bg-white/45 p-3 shadow-premium backdrop-blur-md sm:rounded-3xl sm:p-5 lg:p-6">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
          {items.map(({ icon: Icon, label, description, href }, index) => {
            const accent = itemAccents[index];
            const cardClass = cn(
              surfaceCardInteractive,
              "group relative flex h-full flex-col overflow-hidden p-4 sm:p-5",
              href && "cursor-pointer",
            );

            const content = (
              <>
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100 sm:h-24 sm:w-24",
                    accent.glow,
                    "opacity-70",
                  )}
                />
                <div
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-90",
                    accent.bar,
                  )}
                />
                <span
                  className={cn(
                    "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105 sm:h-12 sm:w-12",
                    accent.iconBg,
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <div className="relative mt-3 flex min-w-0 flex-1 flex-col">
                  <p className="font-display text-sm font-semibold leading-snug text-foreground sm:text-base">
                    {label}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                    {description}
                  </p>
                  {href ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand sm:mt-2.5">
                      {t.hero.learnMore}
                    </span>
                  ) : null}
                </div>
              </>
            );

            return href ? (
              <Link key={label} href={href} className={cardClass}>
                {content}
              </Link>
            ) : (
              <article key={label} className={cardClass}>
                {content}
              </article>
            );
          })}
        </div>
      </div>
    </PageSection>
  );
}
