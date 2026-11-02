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
import Link from "next/link";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { homeVisitCityPath, listHomeVisitCities } from "@/lib/seo/home-visit-cities";
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
  const cities = await listHomeVisitCities();

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
      {cities.length > 0 && (
        <PageSection variant="soft" spacing="default">
          <SectionHeader title="Home visits by city" className="mb-6" />
          <ul className="flex flex-wrap gap-2">
            {cities.map((city) => (
              <li key={city.slug}>
                <Link
                  href={homeVisitCityPath(city.slug)}
                  className="inline-block rounded-full border border-brand/20 bg-white px-4 py-2 text-sm font-medium text-brand-dark transition hover:border-brand/40"
                >
                  Doctor home visit in {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </PageSection>
      )}
      <HomeServicesFaq />
      <HomeServicesCta />
    </>
  );
}
