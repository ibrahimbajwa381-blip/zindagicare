import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses, Roles } from "@zindagi/shared";
import { PhysiotherapistEarningsSplitCard } from "@/features/physiotherapist/components/physiotherapist-earnings-split-card";
import { PhysiotherapistPageHeader } from "@/features/physiotherapist/components/physiotherapist-page-header";
import { PhysiotherapistVisitsDashboard } from "@/features/home-care/components/physiotherapist-visits-dashboard";
import { getPhysiotherapistProfile } from "@/server/services/physiotherapist.service";
import { getServerTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerTranslations();
  return { title: t.homeCare.physiotherapistDashboardTitle };
}

export default async function PhysiotherapistVisitsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/physiotherapist/visits");
  if (!session.user.roles?.includes(Roles.PHYSIOTHERAPIST)) redirect("/onboarding");

  const profile = await getPhysiotherapistProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/physiotherapist");
  }

  const { t } = await getServerTranslations();

  return (
    <>
      <PhysiotherapistPageHeader
        eyebrow="In-house services"
        title={t.homeCare.physiotherapistDashboardTitle}
        description={t.homeCare.physiotherapistDashboardDesc}
      />
      <div className="mb-6">
        <PhysiotherapistEarningsSplitCard />
      </div>
      <PhysiotherapistVisitsDashboard />
    </>
  );
}
