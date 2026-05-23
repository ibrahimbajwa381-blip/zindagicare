import { FaqSection } from "@/features/marketing/components/faq-section";
import { HeroSection } from "@/features/marketing/components/hero-section";
import { HomeServicesPreview } from "@/features/marketing/components/home-services-preview";
import { HowItWorksSection } from "@/features/marketing/components/how-it-works";
import { SundayBanner } from "@/features/marketing/components/sunday-banner";
import { DoctorBrowseSection } from "@/features/marketing/components/doctor-browse-section";
import { TopDoctorsSection } from "@/features/marketing/components/top-doctors-section";
import { TrustBar } from "@/features/marketing/components/trust-bar";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <SundayBanner />
      <TrustBar />
      <DoctorBrowseSection />
      <TopDoctorsSection />
      <HomeServicesPreview />
      <HowItWorksSection />
      <FaqSection />
    </>
  );
}
