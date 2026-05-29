import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { TopDoctorsSection } from "@/features/marketing/components/top-doctors-section";

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
          description="Book a secure video consult with PMDC-verified doctors in Lahore. Search by specialty and ratings — full search coming soon."
        />
      </PageSection>
      <TopDoctorsSection />
    </>
  );
}
