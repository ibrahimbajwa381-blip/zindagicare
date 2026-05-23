import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { TopDoctorsSection } from "@/features/marketing/components/top-doctors-section";

export const metadata = {
  title: "Find Doctors in Lahore | ZindagiCare",
};

export default function DoctorsPage() {
  return (
    <>
      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle
          title="Find doctors in Lahore"
          description="Search by specialty, hospital, and ratings. Full search coming soon."
        />
      </PageSection>
      <TopDoctorsSection />
    </>
  );
}
