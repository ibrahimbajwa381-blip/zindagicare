import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses } from "@zindagi/shared";
import { NutritionistPageHeader } from "@/features/nutritionist/components/nutritionist-page-header";
import { NutritionistEarningsPanel } from "@/features/nutritionist/components/nutritionist-earnings-panel";
import { NutritionistBankAccountCard } from "@/features/nutritionist/components/nutritionist-bank-account-card";
import { NutritionistEarningEligibilityCard } from "@/features/nutritionist/components/nutritionist-earning-eligibility-card";
import { getNutritionistEarnings } from "@/server/services/nutritionist-dashboard.service";
import { getNutritionistProfile } from "@/server/services/nutritionist-profile.service";

export const metadata = { title: "Earnings | Nutritionist" };

export default async function NutritionistEarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/nutritionist/earnings");
  if (!session.user.roles?.includes("nutritionist")) redirect("/onboarding");

  const profile = await getNutritionistProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/nutritionist/profile");
  }

  const earnings = await getNutritionistEarnings(session.user.id);

  return (
    <>
      <NutritionistPageHeader
        eyebrow="Earnings"
        title="Earnings"
        description="Track your earnings, completed consultations, and withdrawals from paid video consultations."
      />
      <div className="space-y-6">
        <NutritionistEarningsPanel earnings={earnings} />
        <NutritionistBankAccountCard />
        <NutritionistEarningEligibilityCard />
      </div>
    </>
  );
}
