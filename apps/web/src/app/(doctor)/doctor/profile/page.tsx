import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { DoctorProfileOverview } from "@/features/doctor/components/doctor-profile-overview";
import { DoctorProfileSection } from "@/features/doctor/components/doctor-profile-section";
import { getDoctorDashboardSummary } from "@/server/services/doctor-dashboard.service";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";

export const metadata = { title: "Doctor workspace" };

type Props = { searchParams: Promise<{ submitted?: string }> };

export default async function DoctorProfilePage({ searchParams }: Props) {
  const session = await auth();
  const { submitted } = await searchParams;

  if (!session?.user) redirect("/login?callbackUrl=/doctor/profile");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  const isApproved = profile.verificationStatus === VerificationStatuses.APPROVED;
  const isPending = profile.verificationStatus === VerificationStatuses.PENDING;
  const hasSubmitted = Boolean(profile.verificationSubmittedAt);

  if (!hasSubmitted && !isApproved) {
    redirect("/doctor/verification");
  }

  const summary = isApproved
    ? await getDoctorDashboardSummary(session.user.id)
    : {
        patients: 0,
        pendingRequests: 0,
        sundayQueue: 0,
        homeVisitRequests: 0,
        urgentCalls: 0,
        totalEarnings: 0,
        earningsThisMonth: 0,
      };

  return (
    <div className="space-y-6">
      {submitted === "1" && isPending && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="font-semibold">Application submitted successfully</p>
          <p className="mt-1">
            An admin will review your credentials shortly. Your workspace unlocks once
            your profile is approved.
          </p>
        </div>
      )}

      {isApproved ? (
        <DoctorProfileOverview profile={profile} summary={summary} />
      ) : (
        <>
          <DoctorProfileOverview profile={profile} summary={summary} />
          <DoctorProfileSection profile={profile} />
        </>
      )}
    </div>
  );
}
