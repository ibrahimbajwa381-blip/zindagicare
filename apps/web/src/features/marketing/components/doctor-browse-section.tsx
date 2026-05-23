import { conditionBrowse } from "../data/browse-catalog";
import { BrowseSectionRow } from "./browse-section-row";
import { PageSection } from "@/components/layout/page-section";
import { SpecialtiesBrowseSection } from "./specialties-browse-section";

export function DoctorBrowseSection() {
  return (
    <PageSection variant="neutral" spacing="lg">
      <SpecialtiesBrowseSection />

      <div className="my-14 h-px bg-gradient-to-r from-transparent via-brand-light/50 to-transparent sm:my-16" />

      <BrowseSectionRow
        title="Search doctor by condition"
        items={conditionBrowse}
        queryParam="condition"
        variant="scroll"
      />
    </PageSection>
  );
}
