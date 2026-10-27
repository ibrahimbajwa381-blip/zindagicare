import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Activity, MapPin, Users } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { WhatsAppCtaButton } from "@/components/shared/whatsapp-cta-button";
import { PageSection } from "@/components/layout/page-section";
import { getServerTranslations } from "@/i18n/server";
import {
  HOME_PHYSIO_HERO_IMAGE,
  HOME_PHYSIO_HERO_IMAGE_CLASS,
} from "@/features/marketing/data/hero-services";

export async function HomePhysioBanner() {
  const { t } = await getServerTranslations();
  const copy = t.homePhysio;
  const bookHref = siteConfig.links.physiotherapists;

  return (
    <PageSection
      id="home-physio"
      spacing="default"
      innerClassName="py-8 sm:py-12 lg:py-16"
    >
      <div className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-muted/40 to-white shadow-premium-lg sm:rounded-3xl">
        <div className="flex flex-col lg:flex-row-reverse">
          <div className="relative h-44 shrink-0 sm:h-52 lg:min-h-[18rem] lg:h-auto lg:w-[36%] xl:w-[34%]">
            <Image
              src={HOME_PHYSIO_HERO_IMAGE}
              alt={copy.imageAlt}
              fill
              unoptimized={!String(HOME_PHYSIO_HERO_IMAGE).startsWith("/")}
              sizes="(max-width: 1024px) 100vw, 34vw"
              className={`object-cover ${HOME_PHYSIO_HERO_IMAGE_CLASS}`}
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-brand-dark/50 via-transparent to-transparent lg:bg-gradient-to-l lg:from-transparent lg:via-transparent lg:to-white/90"
            />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm sm:text-xs">
              <Activity className="h-3.5 w-3.5" />
              {copy.eyebrow}
            </span>
          </div>

          <div className="flex flex-1 flex-col justify-center border-t border-slate-100 px-5 py-5 sm:px-7 sm:py-7 lg:border-r lg:border-t-0 lg:px-9 lg:py-8">
            <h2 className="font-display text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl lg:text-[2rem]">
              {copy.headline}{" "}
              <span className="text-brand">{copy.headlineHighlight}</span>
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:mt-3 sm:text-base">
              {copy.description}
            </p>

            <p className="mt-3 flex max-w-xl items-start gap-2 rounded-xl border border-brand/20 bg-brand-muted/50 px-3 py-2.5 text-sm font-medium text-brand-dark">
              <Users className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
              {copy.genderPreference}
            </p>

            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
                  <Activity className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                {copy.priceLabel}
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <MapPin className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                {copy.badge}
              </li>
            </ul>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Button
                size="lg"
                className="group h-11 w-full rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-premium hover:bg-brand-dark sm:h-12 sm:w-auto sm:text-base"
                asChild
              >
                <Link href={bookHref}>
                  {copy.primaryCta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 w-full rounded-xl border-brand/30 text-sm text-brand-dark hover:border-brand hover:bg-brand-muted sm:h-12 sm:w-auto sm:text-base"
                asChild
              >
                <Link href={siteConfig.links.homePhysiotherapy}>
                  {copy.exploreCta}
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-11 w-full rounded-xl text-sm text-brand-dark sm:h-12 sm:w-auto sm:text-base"
                asChild
              >
                <Link href={siteConfig.links.forPhysiotherapists}>
                  {copy.secondaryCta}
                </Link>
              </Button>
              <WhatsAppCtaButton
                size="lg"
                className="h-11 w-full rounded-xl sm:h-12 sm:w-auto"
                prefill={t.common.whatsappPrefillPhysio}
              />
            </div>
          </div>
        </div>
      </div>
    </PageSection>
  );
}
