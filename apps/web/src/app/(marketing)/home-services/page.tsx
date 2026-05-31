import { HomeServicesHero } from "@/features/marketing/components/home-services-hero";
import { HomeServicesPricing } from "@/features/marketing/components/home-services-pricing";
import { HomeServicesPreview } from "@/features/marketing/components/home-services-preview";
import { HomeServicesHowItWorks } from "@/features/marketing/components/home-services-how-it-works";
import { HomeServicesCoverage } from "@/features/marketing/components/home-services-coverage";
import { HomeServicesFaq } from "@/features/marketing/components/home-services-faq";
import { HomeServicesCta } from "@/features/marketing/components/home-services-cta";
import { getServerTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerTranslations();
  return {
    title: t.homeServices.title,
    description: t.homeServices.hero.body,
  };
}

export default function HomeServicesPage() {
  return (
    <>
      <HomeServicesHero />
      <HomeServicesPricing />
      <HomeServicesPreview variant="catalog" />
      <HomeServicesHowItWorks />
      <HomeServicesCoverage />
      <HomeServicesFaq />
      <HomeServicesCta />
    </>
  );
}
