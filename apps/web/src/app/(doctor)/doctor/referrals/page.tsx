import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses } from "@zindagi/shared";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorReferralCard } from "@/features/doctor/components/doctor-referral-card";
import { DoctorReferredPatientsList } from "@/features/doctor/components/doctor-referred-patients-list";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import {
  getDoctorReferralInfo,
  getReferredPatientsSummary,
} from "@/server/services/doctor-referral.service";

export const metadata = { title: "Referrals | Doctor" };

export default async function DoctorReferralsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/referrals");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  const [referral, summary] = await Promise.all([
    getDoctorReferralInfo(profile.id),
    getReferredPatientsSummary(profile.id),
  ]);

  return (
    <>
      <DoctorPageHeader
        eyebrow="Referrals"
        title="Referrals"
        description="Share your personal link and earn a bigger share on every appointment with the patients you bring in."
      />
      <div className="space-y-6">
        <DoctorReferralCard
          initialUrl={referral.url}
          referredPatientCount={summary.referredPatientCount}
          lifetimeBonusEarnings={summary.lifetimeBonusEarnings}
        />
        <DoctorReferredPatientsList patients={summary.referredPatients} />
      </div>
    </>
  );
}
