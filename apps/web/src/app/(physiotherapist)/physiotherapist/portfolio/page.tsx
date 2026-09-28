import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { PhysiotherapistPageHeader } from "@/features/physiotherapist/components/physiotherapist-page-header";
import { PhysiotherapistPortfolioEditor } from "@/features/physiotherapist/components/portfolio/portfolio-editor";
import { physiotherapistProfilePath } from "@/lib/physiotherapists/profile-path";
import { getPhysiotherapistProfile } from "@/server/services/physiotherapist.service";

export const metadata = { title: "My portfolio | Physiotherapist" };

export default async function PhysiotherapistPortfolioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/physiotherapist/portfolio");
  if (!session.user.roles?.includes(Roles.PHYSIOTHERAPIST)) redirect("/onboarding");

  const profile = await getPhysiotherapistProfile(session.user.id);
  const publicPath =
    profile.verification.status === VerificationStatuses.APPROVED && profile.publicProfile.slug
      ? physiotherapistProfilePath(profile.publicProfile.slug, profile.user.id)
      : null;

  return (
    <>
      <PhysiotherapistPageHeader
        eyebrow="Portfolio"
        title="My portfolio"
        description="Your public profile is your personal website on ZindagiCare. Add your experience, training and photos so patients can choose you with confidence."
      />
      <PhysiotherapistPortfolioEditor
        initialPortfolio={profile.portfolio}
        avatarUrl={profile.user.avatarUrl}
        publicPath={publicPath}
      />
    </>
  );
}
