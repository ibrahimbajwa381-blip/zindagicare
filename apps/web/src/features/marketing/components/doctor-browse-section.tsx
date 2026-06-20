"use client";

import { conditionBrowse } from "../data/browse-catalog";
import { BrowseSectionRow } from "./browse-section-row";
import { PageSection } from "@/components/layout/page-section";
import { SpecialtiesBrowseSection } from "./specialties-browse-section";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { localizeBrowseItems } from "@/i18n/browse";

export function DoctorBrowseSection() {
  const { locale } = useLocale();
  const t = useTranslations();
  const conditions = localizeBrowseItems(conditionBrowse, locale);

  return (
    <PageSection variant="neutral" spacing="lg">
      <div className="space-y-6 sm:space-y-8">
        <SpecialtiesBrowseSection />

        <BrowseSectionRow
          title={t.doctors.searchByCondition}
          items={conditions}
          queryParam="condition"
          viewAllLabel={t.common.viewAll}
          mobileLimit={6}
        />
      </div>
    </PageSection>
  );
}
