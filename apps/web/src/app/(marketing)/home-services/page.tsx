import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { HomeServicesPreview } from "@/features/marketing/components/home-services-preview";

export const metadata = {
  title: "In-house Medical Services",
  description:
    "Licensed doctors and nurses for in-house medical care at your home in Lahore — visits, nursing, IV therapy, and more.",
};

export default function HomeServicesPage() {
  return (
    <>
      <PageSection variant="accent" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle
          title="In-house medical services"
          description="Doctor visits, skilled nursing, IV therapy, wound care, and post-operative support delivered at your home in Lahore."
        />
      </PageSection>
      <HomeServicesPreview />
    </>
  );
}
