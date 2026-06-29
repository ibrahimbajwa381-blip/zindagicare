import { AutoBreadcrumbs } from "@/components/layout/auto-breadcrumbs";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <AutoBreadcrumbs />
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
