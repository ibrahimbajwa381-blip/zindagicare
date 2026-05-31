import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { getServerTranslations } from "@/i18n/server";

export async function HomeServicesCta() {
  const { t } = await getServerTranslations();
  const c = t.homeServices.cta;

  return (
    <PageSection variant="accent" spacing="default">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {c.title}
        </h2>
        <p className="mt-3 text-base text-slate-600 sm:text-lg">{c.description}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" className="h-12 rounded-xl shadow-premium" asChild>
            <Link href={siteConfig.links.homeCareRequest}>
              {c.primary}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 rounded-xl" asChild>
            <Link href={siteConfig.links.homeCareVisits}>{c.secondary}</Link>
          </Button>
        </div>
      </div>
    </PageSection>
  );
}
