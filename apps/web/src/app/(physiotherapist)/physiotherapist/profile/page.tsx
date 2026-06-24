import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses, Roles } from "@zindagi/shared";
import { PhysiotherapistPageHeader } from "@/features/physiotherapist/components/physiotherapist-page-header";
import { PhysiotherapistAvailabilityToggle } from "@/features/physiotherapist/components/physiotherapist-availability-toggle";
import { PhysiotherapistProfileForm } from "@/features/physiotherapist/components/physiotherapist-profile-form";
import { getPhysiotherapistProfile } from "@/server/services/physiotherapist.service";

export const metadata = { title: "My profile | Physiotherapist" };

export default async function PhysiotherapistProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/physiotherapist/profile");
  if (!session.user.roles?.includes(Roles.PHYSIOTHERAPIST)) redirect("/onboarding");

  const profile = await getPhysiotherapistProfile(session.user.id);
  const isApproved =
    profile.verification.status === VerificationStatuses.APPROVED;

  return (
    <>
      <PhysiotherapistPageHeader
        eyebrow="Profile"
        title="My profile"
        description="Keep your contact details and service area current — dispatch uses them to match you with nearby in-house visits."
        actions={
          isApproved ? (
            <PhysiotherapistAvailabilityToggle initialAvailable={profile.staff.isAvailable} />
          ) : undefined
        }
      />
      <PhysiotherapistProfileForm profile={profile} />
    </>
  );
}
