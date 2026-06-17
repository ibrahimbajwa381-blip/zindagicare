import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { HomeCareRequestForm } from "@/features/home-care/components/home-care-request-form";
import { getServerTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerTranslations();
  return { title: t.homeCare.requestTitle };
}

export default async function HomeCareRequestPage() {
  const { t } = await getServerTranslations();

  return (
    <PageShell variant="brand" spacing="default" narrow flipBlur>
      <PageTitle
        eyebrow={t.homeServices.eyebrow}
        title={t.homeCare.requestTitle}
        description={t.homeCare.requestDesc}
      />
      <div className="mt-8">
        <Suspense fallback={<LoadingScreen message="Loading…" />}>
          <HomeCareRequestForm />
        </Suspense>
      </div>
    </PageShell>
  );
}
