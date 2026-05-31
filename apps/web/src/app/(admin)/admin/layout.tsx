import { auth } from "@/lib/auth";
import { isAdmin } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { buildAccountMobileSection } from "@/lib/nav/mobile-menu";
import { getServerTranslations } from "@/i18n/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (!isAdmin(session.user.roles)) redirect("/dashboard");

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
          { href: "/admin", label: "Admin dashboard" },
        ]}
        sections={accountSection ? [accountSection] : []}
      />
      <main className="flex-1">{children}</main>
    </>
  );
}
