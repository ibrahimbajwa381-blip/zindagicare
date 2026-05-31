import { SiteLogo } from "@/components/layout/site-logo";
import { PageSection } from "@/components/layout/page-section";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

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
      className="flex min-h-[min(100dvh,900px)] items-center justify-center"
      innerClassName="flex w-full flex-col items-center gap-8 !py-10 sm:gap-10 sm:!py-16"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <SiteLogo size="xl" priority />
        <LanguageSwitcher />
      </div>
      {children}
    </PageSection>
  );
}
