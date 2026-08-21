import type { Metadata } from "next";
import { Suspense } from "react";
import { FaqJsonLd } from "@/components/seo/faq-json-ld";
import { buildRootMetadata, getSiteUrl } from "@/lib/seo/metadata";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { FaqSection } from "@/features/marketing/components/faq-section";
import { HeroSection } from "@/features/marketing/components/hero-section";
import { HomeServicesPreview } from "@/features/marketing/components/home-services-preview";
import { HomePhysioBanner } from "@/features/marketing/components/home-physio-banner";
import { HowItWorksSection } from "@/features/marketing/components/how-it-works";
import { SundayBanner } from "@/features/marketing/components/sunday-banner";
import { TopDoctorsSection } from "@/features/marketing/components/top-doctors-section";
import { TopDoctorsSectionSkeleton } from "@/features/marketing/components/top-doctors-section-skeleton";
import { ProviderOnboardingPreview } from "@/features/marketing/components/provider-onboarding-preview";
import { TrustBar } from "@/features/marketing/components/trust-bar";

export const metadata: Metadata = buildRootMetadata({
  alternates: { canonical: getSiteUrl() },
});

export default async function HomePage() {
  const locale = await getLocale();
  const faqItems = getDictionary(locale).faq.items;

  return (
    <>
      <FaqJsonLd items={faqItems} />
      <HeroSection />
      <TrustBar />
      <HomeServicesPreview />
      <HomePhysioBanner />
      <Suspense fallback={<TopDoctorsSectionSkeleton />}>
        <TopDoctorsSection />
      </Suspense>
      <SundayBanner />
      <HowItWorksSection />
      <ProviderOnboardingPreview />
      <FaqSection />
    </>
  );
}
