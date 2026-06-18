import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { DoctorsConsultClient } from "@/features/marketing/components/doctors-consult-client";
import { getServerTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerTranslations();
  return {
    title: t.doctors.page.metaTitle,
    description: t.doctors.page.metaDescription,
  };
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
