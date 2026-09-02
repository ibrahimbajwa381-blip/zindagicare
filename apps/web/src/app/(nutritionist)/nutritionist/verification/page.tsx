import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { NutritionistPageHeader } from "@/features/nutritionist/components/nutritionist-page-header";
import { NutritionistVerificationForm } from "@/features/nutritionist/components/nutritionist-verification-form";
import { getNutritionistProfile } from "@/server/services/nutritionist-profile.service";

export const metadata = { title: "Nutritionist verification" };

export default async function NutritionistVerificationPage() {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/nutritionist/verification");
  if (!session.user.roles?.includes("nutritionist")) redirect("/onboarding");

  const status = session.user.nutritionistVerificationStatus;
  const isApproved = status === VerificationStatuses.APPROVED;

  if (isApproved) {
    redirect("/nutritionist/profile");
  }

  let profile;
  try {
    profile = await getNutritionistProfile(session.user.id);
  } catch {
    profile = null;
  }

  const isPending =
    profile?.verification.status === VerificationStatuses.PENDING &&
    profile.verification.submittedAt;

  if (isPending) {
    redirect("/nutritionist/profile");
  }

  const isRejected = profile?.verification.status === VerificationStatuses.REJECTED;

  return (
    <>
      <NutritionistPageHeader
        eyebrow="Onboarding"
        title="Nutritionist verification"
        description="Submit your credentials, availability, and documents. Your profile goes live after admin approval."
      />
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        {isRejected && profile?.verification.rejectionReason && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-medium">Previous application rejected</p>
            <p className="mt-1">{profile.verification.rejectionReason}</p>
          </div>
        )}
        <NutritionistVerificationForm
          name={session.user.name ?? "Nutritionist"}
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
