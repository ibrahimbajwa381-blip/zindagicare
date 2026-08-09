import { auth } from "@/lib/auth";
import { isAdmin } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { buildPrivateMetadata } from "@/lib/seo/metadata";
import { AdminShell } from "@/features/admin/components/admin-shell";

export const metadata = buildPrivateMetadata();

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (!isAdmin(session.user.roles)) redirect("/dashboard");

  return <AdminShell>{children}</AdminShell>;
}
