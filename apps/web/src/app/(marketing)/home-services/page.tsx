import { HomeServicesHero } from "@/features/marketing/components/home-services-hero";
import { HomeServicesPicker } from "@/features/marketing/components/home-services-picker";
import { HomeServicesHowItWorks } from "@/features/marketing/components/home-services-how-it-works";
import { HomeServicesCoverage } from "@/features/marketing/components/home-services-coverage";
import { HomeServicesFaq } from "@/features/marketing/components/home-services-faq";
import { HomeServicesCta } from "@/features/marketing/components/home-services-cta";
import { FaqJsonLd } from "@/components/seo/faq-json-ld";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { JsonLd } from "@/components/seo/json-ld";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildMedicalServiceSchema } from "@/lib/seo/schema";
import { marketingPageSeo } from "@/lib/seo/pages";

export function generateMetadata(): Metadata {
  const seo = marketingPageSeo.homeServices;
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/home-services",
  });
}

export default async function HomeServicesPage() {
  const locale = await getLocale();
  const faqItems = getDictionary(locale).homeServices.faq.items;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "In-house medical services", path: "/home-services" },
        ]}
      />
      <JsonLd
        data={buildMedicalServiceSchema({
          name: marketingPageSeo.homeServices.title,
          description: marketingPageSeo.homeServices.description,
          path: "/home-services",
        })}
      />
      <FaqJsonLd items={faqItems} />
      <HomeServicesHero />
      <HomeServicesPicker />
      <HomeServicesHowItWorks />
      <HomeServicesCoverage />
      <HomeServicesFaq />
      <HomeServicesCta />
    </>
  );
}
