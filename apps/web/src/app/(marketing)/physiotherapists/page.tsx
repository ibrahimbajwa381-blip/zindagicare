import type { Metadata } from "next";
import { PageSection } from "@/components/layout/page-section";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { PhysiotherapistDirectory } from "@/features/marketing/components/physiotherapist-directory";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PublicPhysiotherapistService } from "@/server/services/public-physiotherapist.service";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: "Physiotherapists in Lahore — Home Visits | ZindagiCare",
    description:
      "Browse verified physiotherapists in Lahore and book a home physiotherapy visit with the one nearest to you.",
    path: "/physiotherapists",
  });
}

export default async function PhysiotherapistsPage() {
  const physiotherapists = await PublicPhysiotherapistService.list();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Physiotherapists", path: "/physiotherapists" },
        ]}
      />
      <PageSection variant="brand" spacing="default" flipBlur>
        <SectionHeader
          eyebrow="Physiotherapy"
          title="Verified physiotherapists near you"
          description="View profiles, then book a home visit with a physiotherapist of your choice — or let us send the nearest one."
          className="mb-8"
        />
        <PhysiotherapistDirectory initial={physiotherapists} />
      </PageSection>
    </>
  );
}
