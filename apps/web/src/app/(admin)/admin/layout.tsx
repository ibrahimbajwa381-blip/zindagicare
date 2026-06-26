import dynamic from "next/dynamic";
import { auth } from "@/lib/auth";
import { isAdmin } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { buildPrivateMetadata } from "@/lib/seo/metadata";

const AdminShell = dynamic(() =>
  import("@/features/admin/components/admin-shell").then((mod) => ({
    default: mod.AdminShell,
  })),
);

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
