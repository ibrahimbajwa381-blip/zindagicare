import type { Metadata } from "next";
import { PHYSIOTHERAPY_SPECIALTIES_ALPHABETICAL } from "@zindagi/shared";
import { PageSection } from "@/components/layout/page-section";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { PhysiotherapistDirectory } from "@/features/marketing/components/physiotherapist-directory";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { citiesMatch } from "@/lib/geo/city-match";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PublicPhysiotherapistService } from "@/server/services/public-physiotherapist.service";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ city?: string; specialty?: string }>;
};

/** Resolve ?city= / ?specialty= to canonical option values; unknown values are ignored. */
async function resolveFilters(searchParams: PageProps["searchParams"]) {
  const params = await searchParams;
  const cities = await PublicPhysiotherapistService.listCities();
  const city = params.city ? cities.find((c) => citiesMatch(c, params.city!)) : undefined;
  const specialty = params.specialty
    ? PHYSIOTHERAPY_SPECIALTIES_ALPHABETICAL.find(
        (s) => s.toLowerCase() === params.specialty!.trim().toLowerCase(),
      )
    : undefined;
  return { cities, city, specialty };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { city } = await resolveFilters(searchParams);
  const where = city ?? "Pakistan";
  return buildPageMetadata({
    title: `Physiotherapists in ${where} — Home Visits | ZindagiCare`,
    description: `Browse verified physiotherapists in ${where} and book a home physiotherapy visit with the one nearest to you.`,
    path: "/physiotherapists",
  });
}

export default async function PhysiotherapistsPage({ searchParams }: PageProps) {
  const { cities, city, specialty } = await resolveFilters(searchParams);
  const physiotherapists = await PublicPhysiotherapistService.list({ city, specialty });

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
          title={city ? `Verified physiotherapists in ${city}` : "Verified physiotherapists near you"}
          description="Choose your city and the kind of care you need, then book a home visit with a physiotherapist of your choice — or let us send the nearest one."
          className="mb-8"
        />
        <PhysiotherapistDirectory
          initial={physiotherapists}
          cities={cities}
          specialties={PHYSIOTHERAPY_SPECIALTIES_ALPHABETICAL}
          city={city}
          specialty={specialty}
        />
      </PageSection>
    </>
  );
}
