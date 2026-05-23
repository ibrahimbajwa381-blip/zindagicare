import { SiteLogo } from "@/components/layout/site-logo";
import { PageSection } from "@/components/layout/page-section";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageSection
      variant="soft"
      bordered={false}
      spacing="default"
      className="flex min-h-[min(100svh,900px)] items-center justify-center"
      innerClassName="flex flex-col items-center gap-10 !py-16"
    >
      <SiteLogo size="xl" priority />
      {children}
    </PageSection>
  );
}
