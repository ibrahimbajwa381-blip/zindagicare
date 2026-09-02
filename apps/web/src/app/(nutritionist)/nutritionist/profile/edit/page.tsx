import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NutritionistPageHeader } from "@/features/nutritionist/components/nutritionist-page-header";
import { NutritionistProfileEditForm } from "@/features/nutritionist/components/nutritionist-profile-edit-form";
import { getNutritionistProfile } from "@/server/services/nutritionist-profile.service";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Edit nutritionist profile" };

export default async function NutritionistProfileEditPage() {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/nutritionist/profile/edit");
  if (!session.user.roles?.includes("nutritionist")) redirect("/onboarding");

  const profile = await getNutritionistProfile(session.user.id);

  const canEdit =
    profile.verification.status === VerificationStatuses.APPROVED ||
    profile.verification.status === VerificationStatuses.PENDING;

  if (!canEdit) {
    redirect("/nutritionist/profile");
  }

  const isPending = profile.verification.status === VerificationStatuses.PENDING;

  return (
    <>
      <NutritionistPageHeader
        eyebrow="Profile"
        title="Edit profile"
        description={
          isPending
            ? "Update your bio, fee, practice locations, and availability while we verify your credentials. Council details require a resubmission to change."
            : "Update your bio, consultation fee, practice locations, and availability. Council credentials require admin support to change."
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/nutritionist/profile">Back to overview</Link>
          </Button>
        }
      />
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <NutritionistProfileEditForm profile={profile} />
      </div>
    </>
  );
}
