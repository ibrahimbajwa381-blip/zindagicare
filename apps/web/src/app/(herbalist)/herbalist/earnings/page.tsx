import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses } from "@zindagi/shared";
import { HerbalistPageHeader } from "@/features/herbalist/components/herbalist-page-header";
import { HerbalistEarningsPanel } from "@/features/herbalist/components/herbalist-earnings-panel";
import { HerbalistBankAccountCard } from "@/features/herbalist/components/herbalist-bank-account-card";
import { HerbalistEarningEligibilityCard } from "@/features/herbalist/components/herbalist-earning-eligibility-card";
import { getHerbalistEarnings } from "@/server/services/herbalist-dashboard.service";
import { getHerbalistProfile } from "@/server/services/herbalist-profile.service";

export const metadata = { title: "Earnings | Herbalist" };

export default async function HerbalistEarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/herbalist/earnings");
  if (!session.user.roles?.includes("herbalist")) redirect("/onboarding");

  const profile = await getHerbalistProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/herbalist/profile");
  }

  const earnings = await getHerbalistEarnings(session.user.id);

  return (
    <>
      <HerbalistPageHeader
        eyebrow="Earnings"
        title="Earnings"
        description="Track your earnings, completed consultations, and withdrawals from paid video consultations."
      />
      <div className="space-y-6">
        <HerbalistEarningsPanel earnings={earnings} />
        <HerbalistBankAccountCard />
        <HerbalistEarningEligibilityCard />
      </div>
    </>
  );
}
