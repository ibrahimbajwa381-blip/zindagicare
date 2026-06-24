import { HomeServicesHero } from "@/features/marketing/components/home-services-hero";
import { HomeServicesPicker } from "@/features/marketing/components/home-services-picker";
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
      <HomeServicesPicker />
      <HomeServicesHowItWorks />
      <HomeServicesCoverage />
      <HomeServicesFaq />
      <HomeServicesCta />
    </>
  );
}
