import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";

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

  return (
    <>
      <AppHeader
        links={[
          { href: "/doctor/sunday-consult", label: "Sunday consult" },
          { href: "/doctor/verification", label: "Verification" },
        ]}
      />
      <main className="flex-1">{children}</main>
    </>
  );
}
