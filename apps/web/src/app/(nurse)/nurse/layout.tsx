import { auth } from "@/lib/auth";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { connectDatabase, StaffProfileModel } from "@zindagi/database";
import { NurseShell } from "@/features/nurse/components/nurse-shell";
import { mongoFilter } from "@/lib/mongo/query";

import { buildPrivateMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivateMetadata();

export default async function NurseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/nurse");

  const roles = session.user.roles ?? [];
  if (!roles.includes(Roles.NURSE)) {
    redirect("/dashboard");
  }

  await connectDatabase();
  const staffProfile = await StaffProfileModel.findOne(
    mongoFilter({ userId: session.user.id, staffType: Roles.NURSE }),
  )
    .select("verificationStatus")
    .lean();

  const showFullNav =
    staffProfile?.verificationStatus === VerificationStatuses.APPROVED;

  return (
    <NurseShell showFullNav={showFullNav}>
      {children}
    </NurseShell>
  );
}
