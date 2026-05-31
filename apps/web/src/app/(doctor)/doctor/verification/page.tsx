import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { DoctorVerificationForm } from "@/features/auth/components/doctor-verification-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";

export const metadata = { title: "Doctor verification" };

export default async function DoctorVerificationPage() {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/doctor/verification");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const status = session.user.doctorVerificationStatus;
  const isApproved = status === VerificationStatuses.APPROVED;

  if (isApproved) {
    redirect("/doctor/profile");
  }

  let profile;
  try {
    profile = await getDoctorProfile(session.user.id);
  } catch {
    profile = null;
  }

  const isPending =
    profile?.verificationStatus === VerificationStatuses.PENDING &&
    profile.verificationSubmittedAt;

  if (isPending) {
    redirect("/doctor/profile");
  }

  const isRejected = profile?.verificationStatus === VerificationStatuses.REJECTED;

  return (
    <PageShell variant="soft" spacing="default" narrow>
      <Card className="shadow-premium">
        <CardHeader>
          <CardTitle>Doctor onboarding</CardTitle>
          <CardDescription>
            Submit your credentials, availability, and documents. Your profile goes live
            after admin approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRejected && profile?.rejectionReason && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-medium">Previous application rejected</p>
              <p className="mt-1">{profile.rejectionReason}</p>
            </div>
          )}
          <DoctorVerificationForm />
        </CardContent>
      </Card>
    </PageShell>
  );
}
