import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorVerificationForm } from "@/features/auth/components/doctor-verification-form";
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
    <>
      <DoctorPageHeader
        eyebrow="Onboarding"
        title="Doctor verification"
        description="Submit your credentials, availability, and documents. Your profile goes live after admin approval."
      />
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        {isRejected && profile?.rejectionReason && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-medium">Previous application rejected</p>
            <p className="mt-1">{profile.rejectionReason}</p>
          </div>
        )}
        <DoctorVerificationForm />
      </div>
    </>
  );
}
