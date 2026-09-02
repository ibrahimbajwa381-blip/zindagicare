import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HerbalistProfileModel, connectDatabase } from "@zindagi/database";
import { VerificationStatuses } from "@zindagi/shared";
import { buildPrivateMetadata } from "@/lib/seo/metadata";
import { HerbalistShell } from "@/features/herbalist/components/herbalist-shell";
import { mongoFilter } from "@/lib/mongo/query";

export const metadata = buildPrivateMetadata();

export default async function HerbalistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/herbalist/profile");
  if (!session.user.roles?.includes("herbalist")) {
    redirect("/dashboard");
  }

  await connectDatabase();
  const herbalistProfile = await HerbalistProfileModel.findOne(
    mongoFilter({ userId: session.user.id }),
  )
    .select("verificationStatus")
    .populate("userId", "name avatarUrl")
    .lean();

  const herbalistUser = herbalistProfile?.userId as
    | { name?: string; avatarUrl?: string }
    | null
    | undefined;

  const verificationStatus =
    herbalistProfile?.verificationStatus ?? session.user.herbalistVerificationStatus;

  const showFullNav = verificationStatus === VerificationStatuses.APPROVED;

  return (
    <HerbalistShell
      showFullNav={showFullNav}
      verificationStatus={verificationStatus}
      herbalistName={herbalistUser?.name ?? session.user.name ?? "Herbalist"}
      herbalistAvatarUrl={herbalistUser?.avatarUrl}
    >
      {children}
    </HerbalistShell>
  );
}
