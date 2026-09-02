import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HerbalistPageHeader } from "@/features/herbalist/components/herbalist-page-header";
import { HerbalistProfileEditForm } from "@/features/herbalist/components/herbalist-profile-edit-form";
import { getHerbalistProfile } from "@/server/services/herbalist-profile.service";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Edit herbalist profile" };

export default async function HerbalistProfileEditPage() {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/herbalist/profile/edit");
  if (!session.user.roles?.includes("herbalist")) redirect("/onboarding");

  const profile = await getHerbalistProfile(session.user.id);

  const canEdit =
    profile.verification.status === VerificationStatuses.APPROVED ||
    profile.verification.status === VerificationStatuses.PENDING;

  if (!canEdit) {
    redirect("/herbalist/profile");
  }

  const isPending = profile.verification.status === VerificationStatuses.PENDING;

  return (
    <>
      <HerbalistPageHeader
        eyebrow="Profile"
        title="Edit profile"
        description={
          isPending
            ? "Update your bio, fee, practice locations, and availability while we verify your credentials. Council details require a resubmission to change."
            : "Update your bio, consultation fee, practice locations, and availability. Council credentials require admin support to change."
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/herbalist/profile">Back to overview</Link>
          </Button>
        }
      />
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <HerbalistProfileEditForm profile={profile} />
      </div>
    </>
  );
}
