import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { PatientVisitsSection } from "@/features/home-care/components/patient-visits-section";
import { getServerTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerTranslations();
  return { title: t.homeCare.visitsTitle };
}

export default async function HomeCareVisitsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/home-care/visits");

  const { t } = await getServerTranslations();

  return (
    <PageShell variant="brand" spacing="default" flipBlur>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title={t.homeCare.visitsTitle}
          description={t.homeCare.visitsDesc}
        />
        <Button asChild>
          <Link href="/home-care/request">{t.homeCare.bookVisit}</Link>
        </Button>
      </div>
      <div className="mt-8">
        <PatientVisitsSection />
      </div>
    </PageShell>
  );
}
