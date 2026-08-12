import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { DoctorProfileOverview } from "@/features/doctor/components/doctor-profile-overview";
import { DoctorProfileSection } from "@/features/doctor/components/doctor-profile-section";
import { DoctorRegistrationSubmittedModal } from "@/features/doctor/components/doctor-registration-submitted-modal";
import { WorkspaceSwitcher } from "@/features/auth/components/workspace-switcher";
import {
  emptyDoctorDashboardSummary,
  getDoctorDashboardSummary,
} from "@/server/services/doctor-dashboard.service";
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
    : emptyDoctorDashboardSummary();

  const showSubmittedModal = submitted === "1" && isPending;

  return (
    <div className="space-y-6">
      <WorkspaceSwitcher current="doctor" />

      {showSubmittedModal && (
        <Suspense fallback={null}>
          <DoctorRegistrationSubmittedModal open />
        </Suspense>
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
