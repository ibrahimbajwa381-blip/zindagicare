import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { HerbalistProfileOverview } from "@/features/herbalist/components/herbalist-profile-overview";
import { HerbalistProfileSection } from "@/features/herbalist/components/herbalist-profile-section";
import { getHerbalistProfile } from "@/server/services/herbalist-profile.service";

export const metadata = { title: "Herbalist workspace" };

export default async function HerbalistProfilePage() {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/herbalist/profile");
  if (!session.user.roles?.includes("herbalist")) redirect("/onboarding");

  const profile = await getHerbalistProfile(session.user.id);
  const isApproved = profile.verification.status === VerificationStatuses.APPROVED;
  const hasSubmitted = Boolean(profile.verification.submittedAt);

  if (!hasSubmitted && !isApproved) {
    redirect("/herbalist/verification");
  }

  return (
    <div className="space-y-6">
      {isApproved ? (
        <HerbalistProfileOverview profile={profile} />
      ) : (
        <HerbalistProfileSection profile={profile} />
      )}
    </div>
  );
}
