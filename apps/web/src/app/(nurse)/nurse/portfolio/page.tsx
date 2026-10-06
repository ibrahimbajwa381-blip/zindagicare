import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { NursePageHeader } from "@/features/nurse/components/nurse-page-header";
import { PhysiotherapistPortfolioEditor as StaffPortfolioEditor } from "@/features/physiotherapist/components/portfolio/portfolio-editor";
import { nurseProfilePath } from "@/lib/nurses/profile-path";
import { getNurseProfile } from "@/server/services/nurse.service";

export const metadata = { title: "My portfolio | Nurse" };

export default async function NursePortfolioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/nurse/portfolio");
  if (!session.user.roles?.includes(Roles.NURSE)) redirect("/onboarding");

  const profile = await getNurseProfile(session.user.id);
  const publicPath =
    profile.verification.status === VerificationStatuses.APPROVED && profile.publicProfile.slug
      ? nurseProfilePath(profile.publicProfile.slug, profile.user.id)
      : null;

  return (
    <>
      <NursePageHeader
        eyebrow="Portfolio"
        title="My portfolio"
        description="Your public profile is your personal website on ZindagiCare. Add your experience, training and the care you provide so families can choose you with confidence."
      />
      <StaffPortfolioEditor
        role="nurse"
        initialPortfolio={profile.portfolio}
        avatarUrl={profile.user.avatarUrl}
        publicPath={publicPath}
      />
    </>
  );
}
