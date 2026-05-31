import { conditionBrowse } from "../data/browse-catalog";
import { BrowseSectionRow } from "./browse-section-row";
import { PageSection } from "@/components/layout/page-section";
import { SpecialtiesBrowseSection } from "./specialties-browse-section";
import { getLocale } from "@/i18n/server";
import { getServerTranslations } from "@/i18n/server";
import { localizeBrowseItems } from "@/i18n/browse";

export async function DoctorBrowseSection() {
  const locale = await getLocale();
  const { t } = await getServerTranslations();
  const conditions = localizeBrowseItems(conditionBrowse, locale);

  return (
    <PageSection variant="neutral" spacing="lg">
      <SpecialtiesBrowseSection />

      <div className="my-10 h-px bg-gradient-to-r from-transparent via-brand-light/50 to-transparent sm:my-16" />

      <BrowseSectionRow
        title={t.doctors.searchByCondition}
        items={conditions}
        queryParam="condition"
        variant="scroll"
      />
    </PageSection>
  );
}
