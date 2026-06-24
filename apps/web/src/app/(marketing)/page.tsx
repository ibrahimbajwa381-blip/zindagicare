import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { buildRootMetadata, getSiteUrl } from "@/lib/seo/metadata";
import { FaqSection } from "@/features/marketing/components/faq-section";
import { HeroSection } from "@/features/marketing/components/hero-section";
import { HomeServicesPreview } from "@/features/marketing/components/home-services-preview";
import { HomePhysioBanner } from "@/features/marketing/components/home-physio-banner";
import { HowItWorksSection } from "@/features/marketing/components/how-it-works";
import { SundayBanner } from "@/features/marketing/components/sunday-banner";
import { DoctorBrowseSection } from "@/features/marketing/components/doctor-browse-section";
import { TopDoctorsSection } from "@/features/marketing/components/top-doctors-section";
import { TopDoctorsSectionSkeleton } from "@/features/marketing/components/top-doctors-section-skeleton";
import { ProviderOnboardingPreview } from "@/features/marketing/components/provider-onboarding-preview";
import { TrustBar } from "@/features/marketing/components/trust-bar";

export const metadata: Metadata = buildRootMetadata({
  alternates: { canonical: getSiteUrl() },
});

export default function HomePage() {
  return (
    <>
      <h1 className="sr-only">{siteConfig.seo.defaultTitle}</h1>
      <HeroSection />
      <TrustBar />
      <HomeServicesPreview />
      <HomePhysioBanner />
      <DoctorBrowseSection />
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
