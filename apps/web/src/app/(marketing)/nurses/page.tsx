import type { Metadata } from "next";
import { NURSING_SPECIALTIES_ALPHABETICAL } from "@zindagi/shared";
import { PageSection } from "@/components/layout/page-section";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { NurseDirectory } from "@/features/marketing/components/nurse-directory";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { citiesMatch } from "@/lib/geo/city-match";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PublicNurseService } from "@/server/services/public-nurse.service";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ city?: string; specialty?: string }>;
};

/** Resolve ?city= / ?specialty= to canonical option values; unknown values are ignored. */
async function resolveFilters(searchParams: PageProps["searchParams"]) {
  const params = await searchParams;
  const cities = await PublicNurseService.listCities();
  const city = params.city ? cities.find((c) => citiesMatch(c, params.city!)) : undefined;
  const specialty = params.specialty
    ? NURSING_SPECIALTIES_ALPHABETICAL.find(
        (s) => s.toLowerCase() === params.specialty!.trim().toLowerCase(),
      )
    : undefined;
  return { cities, city, specialty };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { city } = await resolveFilters(searchParams);
  const where = city ?? "Pakistan";
  return buildPageMetadata({
    title: `Nurses in ${where} — Home Visits | ZindagiCare`,
    description: `Browse verified nurses in ${where} and book a home nursing visit with the one nearest to you.`,
    path: "/nurses",
  });
}

export default async function NursesPage({ searchParams }: PageProps) {
  const { cities, city, specialty } = await resolveFilters(searchParams);
  const nurses = await PublicNurseService.list({ city, specialty });

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Nurses", path: "/nurses" },
        ]}
      />
      <PageSection variant="brand" spacing="default" flipBlur>
        <SectionHeader
          eyebrow="Nursing"
          title={city ? `Verified nurses in ${city}` : "Verified nurses near you"}
          description="Choose your city and the kind of care you need, then book a home visit with a nurse of your choice — or let us send the nearest one."
          className="mb-8"
        />
        <NurseDirectory
          initial={nurses}
          cities={cities}
          specialties={NURSING_SPECIALTIES_ALPHABETICAL}
          city={city}
          specialty={specialty}
        />
      </PageSection>
    </>
  );
}
