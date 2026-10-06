import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses, Roles } from "@zindagi/shared";
import { NursePageHeader } from "@/features/nurse/components/nurse-page-header";
import { NurseAvailabilityToggle } from "@/features/nurse/components/nurse-availability-toggle";
import { NurseProfileForm } from "@/features/nurse/components/nurse-profile-form";
import { getNurseProfile } from "@/server/services/nurse.service";

export const metadata = { title: "My profile | Nurse" };

export default async function NurseProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/nurse/profile");
  if (!session.user.roles?.includes(Roles.NURSE)) redirect("/onboarding");

  const profile = await getNurseProfile(session.user.id);
  const isApproved =
    profile.verification.status === VerificationStatuses.APPROVED;

  return (
    <>
      <NursePageHeader
        eyebrow="Profile"
        title="My profile"
        description="Keep your contact details and service area current — dispatch uses them to match you with nearby in-house visits."
        actions={
          isApproved ? (
            <NurseAvailabilityToggle initialAvailable={profile.staff.isAvailable} />
          ) : undefined
        }
      />
      <NurseProfileForm profile={profile} />
    </>
  );
}
