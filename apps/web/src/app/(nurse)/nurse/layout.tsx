import { auth } from "@/lib/auth";
import { Roles } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";

export default async function NurseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/nurse/visits");

  const roles = session.user.roles ?? [];
  if (!roles.includes(Roles.NURSE)) {
    redirect("/dashboard");
  }

  return (
    <>
      <AppHeader
        links={[{ href: "/nurse/visits", label: "My visits" }]}
      />
      <main className="flex-1">{children}</main>
    </>
  );
}
