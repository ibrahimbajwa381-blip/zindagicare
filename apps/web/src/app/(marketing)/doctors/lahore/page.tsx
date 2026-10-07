import type { Metadata } from "next";
import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { JsonLd } from "@/components/seo/json-ld";
import { DoctorsConsultSection } from "@/features/marketing/components/doctors-consult-section";
import { siteConfig } from "@/config/site";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildMedicalServiceSchema } from "@/lib/seo/schema";
import { marketingPageSeo } from "@/lib/seo/pages";

const PATH = "/doctors/lahore";

const title = `Online Doctors in ${siteConfig.launchCity}, Pakistan — ZindagiCare`;
const description = `Find and book PMDC-verified doctors in ${siteConfig.launchCity} for online video consultations, urgent care, and in-house medical visits on ZindagiCare.`;

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: PATH,
});

export default function LahoreDoctorsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Doctors", path: "/doctors" },
          { name: siteConfig.launchCity, path: PATH },
        ]}
      />
      <JsonLd
        data={buildMedicalServiceSchema({
          name: `Online Doctors in ${siteConfig.launchCity}`,
          description: marketingPageSeo.doctors.description,
          path: PATH,
        })}
      />
      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle
          title={`Doctors in ${siteConfig.launchCity}`}
          description={description}
        />
      </PageSection>
      <DoctorsConsultSection initialCity={siteConfig.launchCity} />
    </>
  );
}
