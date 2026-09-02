import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { HerbalistPageHeader } from "@/features/herbalist/components/herbalist-page-header";
import { HerbalistVerificationForm } from "@/features/herbalist/components/herbalist-verification-form";
import { getHerbalistProfile } from "@/server/services/herbalist-profile.service";

export const metadata = { title: "Herbalist verification" };

export default async function HerbalistVerificationPage() {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/herbalist/verification");
  if (!session.user.roles?.includes("herbalist")) redirect("/onboarding");

  const status = session.user.herbalistVerificationStatus;
  const isApproved = status === VerificationStatuses.APPROVED;

  if (isApproved) {
    redirect("/herbalist/profile");
  }

  let profile;
  try {
    profile = await getHerbalistProfile(session.user.id);
  } catch {
    profile = null;
  }

  const isPending =
    profile?.verification.status === VerificationStatuses.PENDING &&
    profile.verification.submittedAt;

  if (isPending) {
    redirect("/herbalist/profile");
  }

  const isRejected = profile?.verification.status === VerificationStatuses.REJECTED;

  return (
    <>
      <HerbalistPageHeader
        eyebrow="Onboarding"
        title="Herbalist verification"
        description="Submit your credentials, availability, and documents. Your profile goes live after admin approval."
      />
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        {isRejected && profile?.verification.rejectionReason && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-medium">Previous application rejected</p>
            <p className="mt-1">{profile.verification.rejectionReason}</p>
          </div>
        )}
        <HerbalistVerificationForm
          name={session.user.name ?? "Herbalist"}
          defaults={
            profile
              ? {
                  licenseNumber: profile.licenseNumber,
                  degree: profile.degree,
                  institute: profile.institute,
                  graduationYear: profile.graduationYear,
                  experienceYears: profile.experienceYears,
                  bio: profile.bio,
                  consultationFee: profile.consultationFee,
                }
              : undefined
          }
        />
      </div>
    </>
  );
}
