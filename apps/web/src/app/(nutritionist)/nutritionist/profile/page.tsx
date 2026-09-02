import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { NutritionistProfileOverview } from "@/features/nutritionist/components/nutritionist-profile-overview";
import { NutritionistProfileSection } from "@/features/nutritionist/components/nutritionist-profile-section";
import { getNutritionistProfile } from "@/server/services/nutritionist-profile.service";

export const metadata = { title: "Nutritionist workspace" };

export default async function NutritionistProfilePage() {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/nutritionist/profile");
  if (!session.user.roles?.includes("nutritionist")) redirect("/onboarding");

  const profile = await getNutritionistProfile(session.user.id);
  const isApproved = profile.verification.status === VerificationStatuses.APPROVED;
  const hasSubmitted = Boolean(profile.verification.submittedAt);

  if (!hasSubmitted && !isApproved) {
    redirect("/nutritionist/verification");
  }

  return (
    <div className="space-y-6">
      {isApproved ? (
        <NutritionistProfileOverview profile={profile} />
      ) : (
        <NutritionistProfileSection profile={profile} />
      )}
    </div>
  );
}
