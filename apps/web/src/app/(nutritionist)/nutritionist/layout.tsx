import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NutritionistProfileModel, connectDatabase } from "@zindagi/database";
import { VerificationStatuses } from "@zindagi/shared";
import { buildPrivateMetadata } from "@/lib/seo/metadata";
import { NutritionistShell } from "@/features/nutritionist/components/nutritionist-shell";
import { mongoFilter } from "@/lib/mongo/query";

export const metadata = buildPrivateMetadata();

export default async function NutritionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/nutritionist/profile");
  if (!session.user.roles?.includes("nutritionist")) {
    redirect("/dashboard");
  }

  await connectDatabase();
  const nutritionistProfile = await NutritionistProfileModel.findOne(
    mongoFilter({ userId: session.user.id }),
  )
    .select("verificationStatus")
    .populate("userId", "name avatarUrl")
    .lean();

  const nutritionistUser = nutritionistProfile?.userId as
    | { name?: string; avatarUrl?: string }
    | null
    | undefined;

  const verificationStatus =
    nutritionistProfile?.verificationStatus ?? session.user.nutritionistVerificationStatus;

  const showFullNav = verificationStatus === VerificationStatuses.APPROVED;

  return (
    <NutritionistShell
      showFullNav={showFullNav}
      verificationStatus={verificationStatus}
      nutritionistName={nutritionistUser?.name ?? session.user.name ?? "Nutritionist"}
      nutritionistAvatarUrl={nutritionistUser?.avatarUrl}
    >
      {children}
    </NutritionistShell>
  );
}
