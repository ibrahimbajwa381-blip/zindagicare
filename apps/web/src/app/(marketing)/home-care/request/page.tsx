import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { HomeCareRequestForm } from "@/features/home-care/components/home-care-request-form";
import { getServerTranslations } from "@/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

const seo = marketingPageSeo.homeCareRequest;

export const metadata: Metadata = buildPageMetadata({
  title: seo.title,
  description: seo.description,
  path: "/home-care/request",
});

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
