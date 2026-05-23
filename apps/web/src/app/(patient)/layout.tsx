import { AppHeader } from "@/components/layout/app-header";
import { siteConfig } from "@/config/site";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader
        links={[
          { href: siteConfig.links.dashboard, label: "Dashboard" },
          { href: siteConfig.links.sundayConsult, label: "Sunday Free Consult" },
          { href: siteConfig.links.doctors, label: "Find doctors" },
        ]}
      />
      <main className="flex-1">{children}</main>
    </>
  );
}
