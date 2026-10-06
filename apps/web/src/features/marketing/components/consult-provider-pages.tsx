import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PageSection } from "@/components/layout/page-section";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { ConsultProviderDirectory } from "@/features/marketing/components/consult-provider-directory";
import { ConsultProviderProfileView } from "@/features/marketing/components/consult-provider-profile-view";
import { SectionHeader } from "@/features/marketing/components/section-header";
import {
  CONSULT_PROVIDER_ROLES,
  type ConsultProviderRole,
} from "@/features/marketing/data/consult-provider-roles";
import { citiesMatch } from "@/lib/geo/city-match";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PublicConsultProviderService } from "@/server/services/public-consult-provider.service";
import { ReviewService } from "@/server/services/review.service";

/**
 * Shared server logic behind /herbalists, /nutritionists and their [slug] profile pages —
 * the route files only pick the role.
 */

export type DirectorySearchParams = Promise<{ city?: string; specialty?: string }>;

/** Resolve ?city= / ?specialty= to canonical option values; unknown values are ignored. */
async function resolveFilters(role: ConsultProviderRole, searchParams: DirectorySearchParams) {
  const params = await searchParams;
  const cities = await PublicConsultProviderService.listCities(role);
  const city = params.city ? cities.find((c) => citiesMatch(c, params.city!)) : undefined;
  const specialty = params.specialty
    ? CONSULT_PROVIDER_ROLES[role].specialties.find(
        (s) => s.toLowerCase() === params.specialty!.trim().toLowerCase(),
      )
    : undefined;
  return { cities, city, specialty };
}

export async function consultProviderDirectoryMetadata(
  role: ConsultProviderRole,
  searchParams: DirectorySearchParams,
): Promise<Metadata> {
  const config = CONSULT_PROVIDER_ROLES[role];
  const { city } = await resolveFilters(role, searchParams);
  const where = city ?? "Pakistan";
  return buildPageMetadata({
    title: `${config.titlePlural} in ${where} — Online Consultation | ZindagiCare`,
    description: `Browse verified ${config.nounPlural} in ${where}. Compare qualifications, experience and consultation hours on ZindagiCare.`,
    path: config.directoryPath,
  });
}

export async function ConsultProviderDirectoryPage({
  role,
  searchParams,
}: {
  role: ConsultProviderRole;
  searchParams: DirectorySearchParams;
}) {
  const config = CONSULT_PROVIDER_ROLES[role];
  const { cities, city, specialty } = await resolveFilters(role, searchParams);
  const providers = await PublicConsultProviderService.list(role, { city, specialty });

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: config.titlePlural, path: config.directoryPath },
        ]}
      />
      <PageSection variant="brand" spacing="default" flipBlur>
        <SectionHeader
          eyebrow={config.field}
          title={city ? `Verified ${config.nounPlural} in ${city}` : `Verified ${config.nounPlural}`}
          description={config.directoryDescription}
          className="mb-8"
        />
        <ConsultProviderDirectory
          role={role}
          initial={providers}
          cities={cities}
          city={city}
          specialty={specialty}
        />
      </PageSection>
    </>
  );
}

export async function consultProviderProfileMetadata(
  role: ConsultProviderRole,
  slug: string,
): Promise<Metadata> {
  const config = CONSULT_PROVIDER_ROLES[role];
  const provider = await PublicConsultProviderService.get(role, slug);
  if (!provider) return { title: `${config.title} not found` };

  const specialty = provider.specialties[0] ?? config.title;
  return buildPageMetadata({
    title: `${provider.name} — ${specialty} | Online Consult ${provider.city}`,
    description:
      provider.bio?.slice(0, 155) ??
      `Consult ${provider.name}, ${specialty} in ${provider.city}, online on ZindagiCare.`,
    path: config.profilePath(provider.slug),
  });
}

export async function ConsultProviderProfilePage({
  role,
  slug,
}: {
  role: ConsultProviderRole;
  slug: string;
}) {
  const config = CONSULT_PROVIDER_ROLES[role];
  const provider = await PublicConsultProviderService.get(role, slug);
  if (!provider) notFound();

  if (slug.toLowerCase() !== provider.slug) {
    permanentRedirect(config.profilePath(provider.slug));
  }

  // Consult reviews reference the provider profile through `doctorId`, like doctors' do.
  const { reviews, total } = await ReviewService.listDoctorReviews(provider.id, { limit: 20 });

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: config.titlePlural, path: config.directoryPath },
          { name: provider.name, path: config.profilePath(provider.slug) },
        ]}
      />
      <PageSection variant="brand" spacing="sm" flipBlur className="md:overflow-clip">
        <ConsultProviderProfileView provider={provider} reviews={reviews} reviewTotal={total} />
      </PageSection>
    </>
  );
}
