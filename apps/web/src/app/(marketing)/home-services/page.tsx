import { HomeServicesHero } from "@/features/marketing/components/home-services-hero";
import { HomeServicesPicker } from "@/features/marketing/components/home-services-picker";
import { HomeServicesHowItWorks } from "@/features/marketing/components/home-services-how-it-works";
import { HomeServicesCoverage } from "@/features/marketing/components/home-services-coverage";
import { HomeServicesFaq } from "@/features/marketing/components/home-services-faq";
import { HomeServicesCta } from "@/features/marketing/components/home-services-cta";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

export function generateMetadata(): Metadata {
  const seo = marketingPageSeo.homeServices;
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/home-services",
  });
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
