import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { NurseVisitsDashboard } from "@/features/home-care/components/nurse-visits-dashboard";
import { getServerTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerTranslations();
  return { title: t.homeCare.nurseDashboardTitle };
}

export default async function NurseVisitsPage() {
  const { t } = await getServerTranslations();

  return (
    <PageShell variant="accent" spacing="default" narrow flipBlur>
      <PageTitle
        title={t.homeCare.nurseDashboardTitle}
        description={t.homeCare.nurseDashboardDesc}
      />
      <div className="mt-8">
        <NurseVisitsDashboard />
      </div>
    </PageShell>
  );
}
