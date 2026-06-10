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
