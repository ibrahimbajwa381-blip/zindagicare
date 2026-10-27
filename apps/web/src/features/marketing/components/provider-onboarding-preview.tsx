import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowRight, Stethoscope, Syringe } from "lucide-react";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { PROVIDER_ONBOARDING_IMAGES } from "@/features/marketing/data/provider-onboarding-images";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

export async function ProviderOnboardingPreview() {
  const { t } = await getServerTranslations();
  const preview = t.providerOnboarding.preview;

  const cards = [
    {
      href: siteConfig.links.forDoctors,
      icon: Stethoscope,
      image: PROVIDER_ONBOARDING_IMAGES.doctor.preview,
      title: preview.doctorCard.title,
      description: preview.doctorCard.description,
      cta: preview.doctorCard.cta,
      iconClassName: "bg-sky-500/10 text-sky-700",
    },
    {
      href: siteConfig.links.forNurses,
      icon: Syringe,
      image: PROVIDER_ONBOARDING_IMAGES.nurse.preview,
      title: preview.nurseCard.title,
      description: preview.nurseCard.description,
      cta: preview.nurseCard.cta,
      iconClassName: "bg-emerald-500/10 text-emerald-700",
    },
    {
      href: siteConfig.links.forPhysiotherapists,
      icon: Activity,
      image: PROVIDER_ONBOARDING_IMAGES.physiotherapist.preview,
      title: t.providerOnboarding.physiotherapist.eyebrow,
      description: t.providerOnboarding.physiotherapist.body,
      cta: preview.doctorCard.cta,
      iconClassName: "bg-violet-500/10 text-violet-700",
    },
  ] as const;

  return (
    <PageSection id="for-providers" variant="soft" spacing="default">
      <SectionHeader
        eyebrow={preview.eyebrow}
        title={preview.title}
        description={preview.description}
        align="center"
        className="mx-auto"
      />
      <div className="mt-8 grid gap-5 sm:mt-10 lg:grid-cols-3 lg:gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className={`group flex h-full flex-col overflow-hidden sm:flex-row ${surfaceCardInteractive}`}
            >
              <div className="relative aspect-[5/4] w-full shrink-0 sm:aspect-auto sm:w-[44%] sm:min-h-[18rem] lg:min-h-[19rem]">
                <Image
                  src={card.image.src}
                  alt={card.image.alt}
                  fill
                  unoptimized={!String(card.image.src).startsWith("/")}
                  sizes="(max-width: 640px) 100vw, 22vw"
                  className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>

              <div className="flex flex-1 flex-col justify-center border-t border-slate-100 p-6 sm:border-l sm:border-t-0 sm:p-7 lg:p-8">
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${card.iconClassName}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold text-foreground sm:text-2xl [:where(html[lang=ur])_&]:leading-[2.1] [:where(html[lang=ur])_&]:font-medium">
                  {card.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600 sm:text-base [:where(html[lang=ur])_&]:leading-[2.25]">
                  {card.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors group-hover:text-brand-dark">
                  {card.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </PageSection>
  );
}
