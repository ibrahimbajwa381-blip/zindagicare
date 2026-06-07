import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { DoctorsConsultClient } from "@/features/marketing/components/doctors-consult-client";

export const metadata = {
  title: "Online Consultation",
  description:
    "Book secure video consultations with PMDC-verified doctors in Lahore on ZindagiCare.",
};

export default function DoctorsPage() {
  return (
    <>
      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle
          title="Online consultation"
          description="Choose a PMDC-verified doctor, pick a slot, and complete a test payment during MVP. Free care is available only on Sundays."
        />
      </PageSection>
      <DoctorsConsultClient />
    </>
  );
}
