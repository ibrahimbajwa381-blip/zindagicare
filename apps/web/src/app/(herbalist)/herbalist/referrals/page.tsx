import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses } from "@zindagi/shared";
import { HerbalistPageHeader } from "@/features/herbalist/components/herbalist-page-header";
import { HerbalistReferralCard } from "@/features/herbalist/components/herbalist-referral-card";
import { HerbalistReferredPatientsList } from "@/features/herbalist/components/herbalist-referred-patients-list";
import { getHerbalistProfile, getHerbalistProfileIdForUser } from "@/server/services/herbalist-profile.service";
import {
  getHerbalistReferralInfo,
  getHerbalistReferredPatientsSummary,
} from "@/server/services/herbalist-referral.service";

export const metadata = { title: "Referrals | Herbalist" };

export default async function HerbalistReferralsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/herbalist/referrals");
  if (!session.user.roles?.includes("herbalist")) redirect("/onboarding");

  const profile = await getHerbalistProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/herbalist/profile");
  }

  const profileId = await getHerbalistProfileIdForUser(session.user.id);
  const [referral, summary] = await Promise.all([
    getHerbalistReferralInfo(profileId),
    getHerbalistReferredPatientsSummary(profileId),
  ]);

  return (
    <>
      <HerbalistPageHeader
        eyebrow="Referrals"
        title="Referrals"
        description="Share your personal link and earn a bigger share on every appointment with the patients you bring in."
      />
      <div className="space-y-6">
        <HerbalistReferralCard
          code={referral.code}
          url={referral.url}
          referredPatientCount={summary.referredPatientCount}
          lifetimeBonusEarnings={summary.lifetimeBonusEarnings}
        />
        <HerbalistReferredPatientsList patients={summary.referredPatients} />
      </div>
    </>
  );
}
