import { Suspense } from "react";
import Link from "next/link";
import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export default function UrgentFailedPage() {
  return (
    <PageSection variant="soft" spacing="lg">
      <PageTitle
        title="Payment could not be completed"
        description="Your urgent care request was not confirmed. You can try again when ready."
      />
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild className="bg-brand text-white hover:bg-brand-dark">
          <Link href={siteConfig.links.urgentCare}>Try urgent care again</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={siteConfig.links.dashboard}>Go to dashboard</Link>
        </Button>
      </div>
    </PageSection>
  );
}
