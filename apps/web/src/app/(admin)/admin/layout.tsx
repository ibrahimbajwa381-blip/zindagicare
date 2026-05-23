import { auth } from "@/lib/auth";
import { isAdmin } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/doctors");
  if (!isAdmin(session.user.roles)) redirect("/dashboard");

  return (
    <>
      <AppHeader
        links={[{ href: "/admin/doctors", label: "Doctor verifications" }]}
      />
      <main className="flex-1">{children}</main>
    </>
  );
}
