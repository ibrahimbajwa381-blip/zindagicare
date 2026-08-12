import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorProfileEditForm } from "@/features/doctor/components/doctor-profile-edit-form";
import { DoctorIntakeQuestionsEditor } from "@/features/intake/components/doctor-intake-questions-editor";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Edit doctor profile" };

export default async function DoctorProfileEditPage() {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/doctor/profile/edit");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);

  const canEdit =
    profile.verificationStatus === VerificationStatuses.APPROVED ||
    profile.verificationStatus === VerificationStatuses.PENDING;

  if (!canEdit) {
    redirect("/doctor/profile");
  }

  const isPending = profile.verificationStatus === VerificationStatuses.PENDING;

  return (
    <>
      <DoctorPageHeader
        eyebrow="Profile"
        title="Edit profile"
        description={
          isPending
            ? "Update your bio, fee, practice locations, and availability while we verify your credentials. PMDC details require a resubmission to change."
            : "Update your bio, consultation fee, practice locations, and availability. PMDC credentials require admin support to change."
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/doctor/profile">Back to overview</Link>
          </Button>
        }
      />
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <DoctorProfileEditForm profile={profile} />
      </div>
      {profile.verificationStatus === VerificationStatuses.APPROVED && (
        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <DoctorIntakeQuestionsEditor />
        </div>
      )}
    </>
  );
}
