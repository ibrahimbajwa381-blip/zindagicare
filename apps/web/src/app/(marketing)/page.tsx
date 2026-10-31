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
import { DoctorBrowseSection } from "@/features/marketing/components/doctor-browse-section";
import { CareTeamSection } from "@/features/marketing/components/care-team-section";
// Hidden for now: re-enable with the <ConsultProvidersSection /> below.
// import { ConsultProvidersSection } from "@/features/marketing/components/consult-providers-section";
import { ProviderOnboardingPreview } from "@/features/marketing/components/provider-onboarding-preview";
import { TestimonialsSection } from "@/features/marketing/components/testimonials-section";
import { TrustBar } from "@/features/marketing/components/trust-bar";
import { RefundGuaranteeBar } from "@/features/marketing/components/refund-guarantee-bar";
// Hidden for now: re-enable with the <HomeQaSection /> below.
// import { HomeQaSection } from "@/features/medical-qa/components/home-qa-section";

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
      <RefundGuaranteeBar />
      {/* Free public Q&A, kept near the top so patients find it without scrolling far. */}
      {/* <HomeQaSection /> */}
      <HomeServicesPreview />
      <HomePhysioBanner />
      {/* Herbalists & nutritionists section hidden from the landing page for now. */}
      {/* <Suspense fallback={null}>
        <ConsultProvidersSection />
      </Suspense> */}
      <Suspense fallback={<TopDoctorsSectionSkeleton />}>
        <TopDoctorsSection />
      </Suspense>
      <Suspense fallback={<TopDoctorsSectionSkeleton label="Loading care team" />}>
        <CareTeamSection />
      </Suspense>
      <DoctorBrowseSection />
      <SundayBanner />
      <HowItWorksSection />
      {/* Below-the-fold DB query — must not hold the hero (LCP) behind loading.tsx. */}
      <Suspense fallback={null}>
        <TestimonialsSection />
      </Suspense>
      <ProviderOnboardingPreview />
      <FaqSection />
    </>
  );
}
