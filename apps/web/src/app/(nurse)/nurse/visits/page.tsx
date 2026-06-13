import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses } from "@zindagi/shared";
import { NursePageHeader } from "@/features/nurse/components/nurse-page-header";
import { NurseVisitsDashboard } from "@/features/home-care/components/nurse-visits-dashboard";
import { getNurseProfile } from "@/server/services/nurse.service";
import { getServerTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerTranslations();
  return { title: t.homeCare.nurseDashboardTitle };
}

export default async function NurseVisitsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/nurse/visits");
  if (!session.user.roles?.includes("nurse")) redirect("/onboarding");

  const profile = await getNurseProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/nurse");
  }

  const { t } = await getServerTranslations();

  return (
    <>
      <NursePageHeader
        eyebrow="In-house services"
        title={t.homeCare.nurseDashboardTitle}
        description={t.homeCare.nurseDashboardDesc}
      />
      <NurseVisitsDashboard />
    </>
  );
}
