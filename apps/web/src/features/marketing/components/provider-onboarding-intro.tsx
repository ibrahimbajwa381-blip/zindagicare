import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ClipboardList,
  FileCheck,
  Home,
  LayoutDashboard,
  MapPinned,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  Sun,
  Syringe,
  UserPlus,
  Video,
  Wallet,
  Clock,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { surfaceCardInteractive, surfaceInset } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { getProviderHeroImage } from "@/features/marketing/data/provider-onboarding-images";
import { getServerTranslations } from "@/i18n/server";

export type ProviderRole = "doctor" | "nurse" | "physiotherapist";

const doctorBenefitIcons = [
  Video,
  Sun,
  Home,
  MessageSquare,
  ShieldCheck,
  Wallet,
] as const;

const nurseBenefitIcons = [
  MapPinned,
  ClipboardList,
  Syringe,
  LayoutDashboard,
  ShieldCheck,
  Clock,
] as const;

const physiotherapistBenefitIcons = [
  MapPinned,
  Activity,
  Home,
  LayoutDashboard,
  ShieldCheck,
  Clock,
] as const;

const stepIcons = [UserPlus, FileCheck, ArrowRight] as const;
const stepNumbers = ["01", "02", "03"] as const;

const roleIcons: Record<ProviderRole, LucideIcon> = {
  doctor: Stethoscope,
  nurse: Syringe,
  physiotherapist: Activity,
};

const registerLinks: Record<ProviderRole, string> = {
  doctor: siteConfig.links.registerDoctor,
  nurse: siteConfig.links.registerNurse,
  physiotherapist: siteConfig.links.registerPhysiotherapist,
};

type ProviderOnboardingIntroProps = {
  role: ProviderRole;
};

export async function ProviderOnboardingIntro({ role }: ProviderOnboardingIntroProps) {
  const { t } = await getServerTranslations();
  const content = t.providerOnboarding[role];
  const benefitIcons =
    role === "doctor"
      ? doctorBenefitIcons
      : role === "nurse"
        ? nurseBenefitIcons
        : physiotherapistBenefitIcons;
  const RoleIcon = roleIcons[role];
  const heroImage = getProviderHeroImage(role);
  const guide =
    role === "doctor"
      ? { href: siteConfig.links.forDoctorsGuide, label: t.providerOnboarding.doctor.guideCta }
      : role === "physiotherapist"
        ? {
            href: siteConfig.links.forPhysiotherapistsGuide,
            label: t.providerOnboarding.physiotherapist.guideCta,
          }
        : null;

  return (
    <>
      <PageSection spacing="tall" variant="brand">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white sm:text-sm">
              <RoleIcon className="h-4 w-4" />
              {content.eyebrow}
            </p>

            <h1 className="mt-5 font-display text-3xl font-semibold leading-[1.12] tracking-tight text-foreground sm:mt-8 sm:text-5xl lg:text-6xl">
              {content.title}
            </h1>
            <p className="mt-3 text-lg font-semibold text-brand-dark sm:text-xl lg:text-2xl">
              {content.subheadline}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-700 sm:mt-6 sm:text-lg">
              {content.body}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button size="lg" className="h-12 rounded-xl shadow-premium sm:h-14" asChild>
                <Link href={registerLinks[role]}>
                  {content.primaryCta}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              {guide ? (
                <Button size="lg" variant="outline" className="h-12 rounded-xl sm:h-14" asChild>
                  <Link href={guide.href}>{guide.label}</Link>
                </Button>
              ) : (
                <Button size="lg" variant="outline" className="h-12 rounded-xl sm:h-14" asChild>
                  <Link href={siteConfig.links.login}>{content.secondaryCta}</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-premium lg:aspect-[5/4]">
            <Image
              src={heroImage.src}
              alt={heroImage.alt}
              fill
              priority
              unoptimized
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </PageSection>

      <PageSection variant="soft" spacing="lg">
        <SectionHeader
          eyebrow={content.stepsEyebrow}
          title={content.stepsTitle}
          description={content.stepsDescription}
          align="center"
          className="mx-auto"
        />
        <ol className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {content.steps.map((step, index) => {
            const Icon = stepIcons[index];
            return (
              <li
                key={stepNumbers[index]}
                className={`flex h-full flex-col p-6 ${surfaceCardInteractive}`}
              >
                <span className="font-display text-4xl font-semibold text-brand/25">
                  {stepNumbers[index]}
                </span>
                <span className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 font-display text-lg font-semibold text-foreground">
                  {step.title}
                </p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{step.desc}</p>
              </li>
            );
          })}
        </ol>
      </PageSection>

      <PageSection variant="accent" spacing="lg">
        <SectionHeader
          eyebrow={content.benefitsEyebrow}
          title={content.benefitsTitle}
          description={content.benefitsDescription}
          align="center"
          className="mx-auto"
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {content.benefits.map((item, index) => {
            const Icon = benefitIcons[index];
            return (
              <article key={item.title} className={`relative p-6 ${surfaceCardInteractive}`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
              </article>
            );
          })}
        </div>
      </PageSection>

      <PageSection spacing="default">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {content.ctaTitle}
          </h2>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">{content.ctaDescription}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="h-12 rounded-xl shadow-premium" asChild>
              <Link href={registerLinks[role]}>
                {content.primaryCta}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            {guide ? (
              <Button size="lg" variant="outline" className="h-12 rounded-xl" asChild>
                <Link href={guide.href}>{guide.label}</Link>
              </Button>
            ) : null}
            <Button size="lg" variant="outline" className="h-12 rounded-xl" asChild>
              <Link href={siteConfig.links.login}>{content.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      </PageSection>
    </>
  );
}
