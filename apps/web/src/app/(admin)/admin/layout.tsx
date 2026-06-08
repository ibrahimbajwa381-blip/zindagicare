import { auth } from "@/lib/auth";
import { isAdmin } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { AdminShell } from "@/features/admin/components/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (!isAdmin(session.user.roles)) redirect("/dashboard");

  return (
    <AdminShell
      user={{
        name: session.user.name,
        email: session.user.email,
      }}
    >
      {children}
    </AdminShell>
  );
}
