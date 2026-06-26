import type { Metadata } from "next";
import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { DoctorsConsultClient } from "@/features/marketing/components/doctors-consult-client";
import { getServerTranslations } from "@/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

export function generateMetadata(): Metadata {
  const seo = marketingPageSeo.doctors;
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/doctors",
  });
}

export default async function DoctorsPage() {
  const { t } = await getServerTranslations();
  const copy = t.doctors.page;

  return (
    <>
      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle title={copy.title} description={copy.description} />
      </PageSection>
      <DoctorsConsultClient />
    </>
  );
}
