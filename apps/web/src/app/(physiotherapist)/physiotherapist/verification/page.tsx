import Link from "next/link";
import { auth } from "@/lib/auth";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { redirect } from "next/navigation";
import { VerificationStatuses, Roles } from "@zindagi/shared";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhysiotherapistPageHeader } from "@/features/physiotherapist/components/physiotherapist-page-header";
import { PhysiotherapistVerificationForm } from "@/features/physiotherapist/components/physiotherapist-verification-form";
import { getPhysiotherapistProfile } from "@/server/services/physiotherapist.service";

export const metadata = { title: "Verification | Physiotherapist" };

export default async function PhysiotherapistVerificationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/physiotherapist/verification");
  if (!session.user.roles?.includes(Roles.PHYSIOTHERAPIST)) redirect(AUTH_ROUTES.registerPhysiotherapist);

  const profile = await getPhysiotherapistProfile(session.user.id);
  if (profile.verification.status === VerificationStatuses.APPROVED) {
    redirect("/physiotherapist");
  }

  const isRejected = profile.verification.status === VerificationStatuses.REJECTED;
  const isPendingReview =
    profile.verification.status === VerificationStatuses.PENDING &&
    Boolean(profile.verification.submittedAt);

  if (isPendingReview) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <PhysiotherapistPageHeader
          eyebrow="Verification"
          title="Application under review"
          description="Your credentials have been submitted. An admin will review your application before your account is activated."
        />

        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <Clock className="h-7 w-7" />
          </span>
          <p className="mt-5 text-lg font-semibold text-sky-950">
            Your account will be active after admin approval
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-sky-900/80">
            We&apos;ve received your nursing license, service area, and identity
            documents. You&apos;ll be able to receive in-house visit assignments once
            an admin approves your profile.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/physiotherapist">Back to overview</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PhysiotherapistPageHeader
        eyebrow="Verification"
        title={isRejected ? "Resubmit your application" : "Verify your credentials"}
        description="Submit your nursing license, service area, and identity documents. An admin will review your application before you can receive in-house visit assignments."
      />

      {isRejected && profile.verification.rejectionReason && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <p className="font-semibold">Your previous application was rejected</p>
          <p className="mt-1">{profile.verification.rejectionReason}</p>
          <p className="mt-1">
            Update your details and documents below, then submit again.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <PhysiotherapistVerificationForm
          defaults={{
            licenseNumber: profile.verification.licenseNumber,
            qualification: profile.verification.qualification,
            experienceYears: profile.verification.experienceYears,
            city: profile.staff.serviceArea.city,
            area: profile.staff.serviceArea.area,
          }}
        />
      </div>
    </div>
  );
}
