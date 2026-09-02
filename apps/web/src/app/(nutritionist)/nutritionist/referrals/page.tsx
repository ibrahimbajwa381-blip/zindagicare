import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses } from "@zindagi/shared";
import { NutritionistPageHeader } from "@/features/nutritionist/components/nutritionist-page-header";
import { NutritionistReferralCard } from "@/features/nutritionist/components/nutritionist-referral-card";
import { NutritionistReferredPatientsList } from "@/features/nutritionist/components/nutritionist-referred-patients-list";
import { getNutritionistProfile, getNutritionistProfileIdForUser } from "@/server/services/nutritionist-profile.service";
import {
  getNutritionistReferralInfo,
  getNutritionistReferredPatientsSummary,
} from "@/server/services/nutritionist-referral.service";

export const metadata = { title: "Referrals | Nutritionist" };

export default async function NutritionistReferralsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/nutritionist/referrals");
  if (!session.user.roles?.includes("nutritionist")) redirect("/onboarding");

  const profile = await getNutritionistProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/nutritionist/profile");
  }

  const profileId = await getNutritionistProfileIdForUser(session.user.id);
  const [referral, summary] = await Promise.all([
    getNutritionistReferralInfo(profileId),
    getNutritionistReferredPatientsSummary(profileId),
  ]);

  return (
    <>
      <NutritionistPageHeader
        eyebrow="Referrals"
        title="Referrals"
        description="Share your personal link and earn a bigger share on every appointment with the patients you bring in."
      />
      <div className="space-y-6">
        <NutritionistReferralCard
          code={referral.code}
          url={referral.url}
          referredPatientCount={summary.referredPatientCount}
          lifetimeBonusEarnings={summary.lifetimeBonusEarnings}
        />
        <NutritionistReferredPatientsList patients={summary.referredPatients} />
      </div>
    </>
  );
}
