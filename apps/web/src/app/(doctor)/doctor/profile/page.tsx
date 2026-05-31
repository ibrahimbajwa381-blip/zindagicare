import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { DoctorDashboardHero } from "@/features/doctor/components/doctor-dashboard-hero";
import { DoctorProfileSection } from "@/features/doctor/components/doctor-profile-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      };

  return (
    <PageShell variant="soft" spacing="default" narrow>
      <DoctorDashboardHero profile={profile} summary={summary} />

      {submitted === "1" && isPending && (
        <Card className="mt-6 border-emerald-200 bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-emerald-900">
              Application submitted successfully
            </CardTitle>
            <CardDescription className="text-emerald-800">
              An admin will review your credentials shortly. Your workspace unlocks once
              your profile is approved.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="mt-8">
        <DoctorProfileSection profile={profile} />
      </div>
    </PageShell>
  );
}
