import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { buildAccountMobileSection } from "@/lib/nav/mobile-menu";
import { getServerTranslations } from "@/i18n/server";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/sunday-consult");
  if (!session.user.roles?.includes("doctor")) {
    redirect("/dashboard");
  }

  const { t } = await getServerTranslations();
  const accountSection = buildAccountMobileSection(session, {
    sectionTitle: t.footer.account,
    myDashboard: t.dashboard.header.myDashboard,
    signOut: t.dashboard.header.signOut,
    login: t.auth.login,
    createAccount: t.auth.createAccount,
  });

  return (
    <>
      <AppHeader
        links={[
          { href: "/", label: t.nav.home },
          { href: "/doctor/profile", label: "Workspace" },
          { href: "/doctor/sunday-consult", label: "Sunday consult" },
        ]}
        sections={accountSection ? [accountSection] : []}
      />
      <main className="flex-1">{children}</main>
    </>
  );
}
