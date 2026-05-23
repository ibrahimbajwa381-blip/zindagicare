import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { HomeServicesPreview } from "@/features/marketing/components/home-services-preview";

export const metadata = {
  title: "Home Visit & IV Services | ZindagiCare",
};

export default function HomeServicesPage() {
  return (
    <>
      <PageSection variant="accent" spacing="default" flipBlur innerClassName="!py-12 sm:!py-16">
        <PageTitle
          title="Home services in Lahore"
          description="Doctor visits, nursing, IV drips, and sample collection at your doorstep."
        />
      </PageSection>
      <HomeServicesPreview />
    </>
  );
}
