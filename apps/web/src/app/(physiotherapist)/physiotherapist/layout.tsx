import { auth } from "@/lib/auth";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { connectDatabase, StaffProfileModel } from "@zindagi/database";
import { PhysiotherapistShell } from "@/features/physiotherapist/components/physiotherapist-shell";
import { mongoFilter } from "@/lib/mongo/query";

export default async function PhysiotherapistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/physiotherapist");

  const roles = session.user.roles ?? [];
  if (!roles.includes(Roles.PHYSIOTHERAPIST)) {
    redirect("/dashboard");
  }

  await connectDatabase();
  const staffProfile = await StaffProfileModel.findOne(
    mongoFilter({ userId: session.user.id, staffType: Roles.PHYSIOTHERAPIST }),
  )
    .select("verificationStatus")
    .lean();

  const showFullNav =
    staffProfile?.verificationStatus === VerificationStatuses.APPROVED;

  return (
    <PhysiotherapistShell showFullNav={showFullNav}>
      {children}
    </PhysiotherapistShell>
  );
}
