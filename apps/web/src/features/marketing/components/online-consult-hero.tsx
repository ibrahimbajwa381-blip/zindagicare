import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  ShieldCheck,
  Video,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { getServerTranslations } from "@/i18n/server";
import { ONLINE_CONSULT_HERO_IMAGE } from "@/features/marketing/data/hero-services";

const highlightIcons = [ShieldCheck, Video, FileText] as const;

export async function OnlineConsultHero() {
  const { t } = await getServerTranslations();
  const h = t.doctors.page.hero;
  const page = t.doctors.page;

  return (
    <PageSection spacing="tall" variant="soft" innerClassName="py-8 sm:py-12 lg:py-16">
      <div className="overflow-hidden rounded-2xl border border-brand-light/30 bg-white shadow-premium-lg sm:rounded-3xl">
        <div className="flex flex-col lg:flex-row-reverse">
          <div className="relative order-0 h-52 shrink-0 sm:h-64 lg:order-none lg:h-auto lg:w-[42%] xl:w-[40%]">
            <Image
              src={ONLINE_CONSULT_HERO_IMAGE}
              alt={page.imageAlt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover object-top"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-brand-dark/60 via-brand-dark/10 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-white/95"
            />

            <div className="absolute inset-x-4 bottom-4 sm:inset-x-5 sm:bottom-5 lg:inset-x-6 lg:bottom-6">
              <div className="glass-card rounded-2xl p-4 sm:p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-dark">
                  {t.doctors.eyebrow}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
                  {h.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-white/60 bg-white/70 px-2 py-2.5 text-center backdrop-blur-sm sm:px-3"
                    >
                      <p className="font-display text-lg font-semibold text-brand-dark sm:text-xl">
                        {stat.value}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium leading-tight text-slate-600 sm:text-xs">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 flex flex-1 flex-col justify-center px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-12 xl:px-12">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-brand/20 bg-brand-muted px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-dark sm:text-sm">
              <BadgeCheck className="h-4 w-4" />
              {h.badge}
            </p>

            <h1 className="mt-5 font-display text-[1.75rem] font-semibold leading-[1.12] tracking-tight text-foreground sm:mt-6 sm:text-4xl lg:text-5xl xl:text-[3.25rem]">
              {h.headline}{" "}
              <span className="text-gradient-premium">{h.headlineHighlight}</span>
            </h1>

            <p className="mt-3 max-w-xl text-base font-medium text-brand-dark sm:text-lg lg:text-xl">
              {h.subheadline}
            </p>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              {h.body}
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Button
                size="lg"
                className="group h-12 w-full rounded-xl shadow-premium sm:w-auto"
                asChild
              >
                <Link href="#browse-doctors">
                  {h.primaryCta}
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-brand/25"
                asChild
              >
                <Link href="#how-online-consult-works">{h.secondaryCta}</Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 rounded-xl text-brand-dark"
                asChild
              >
                <Link href={siteConfig.links.sundayConsult}>{h.tertiaryCta}</Link>
              </Button>
            </div>

            <ul className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
              {h.highlights.map((item, index) => {
                const Icon = highlightIcons[index];
                return (
                  <li
                    key={item.title}
                    className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 sm:flex-col sm:items-start sm:gap-2"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-dark to-brand text-white shadow-sm">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 text-sm leading-snug">
                      <strong className="block font-semibold text-foreground">{item.title}</strong>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-600 sm:text-sm">
                        {item.desc}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </PageSection>
  );
}
