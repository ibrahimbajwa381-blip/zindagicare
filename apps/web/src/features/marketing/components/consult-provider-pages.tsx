import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight, MessageCircle, Search, UserPlus, Video } from "lucide-react";
import { cn } from "@zindagi/shared";
import { PageSection } from "@/components/layout/page-section";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { Button } from "@/components/ui/button";
import { ConsultProviderDirectory } from "@/features/marketing/components/consult-provider-directory";
import { ConsultProviderProfileView } from "@/features/marketing/components/consult-provider-profile-view";
import { SectionHeader } from "@/features/marketing/components/section-header";
import {
  CONSULT_PROVIDER_ROLES,
  consultMatchWhatsAppHref,
  consultSpecialtyHref,
  type ConsultProviderRole,
} from "@/features/marketing/data/consult-provider-roles";
import { citiesMatch } from "@/lib/geo/city-match";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { surfaceCard } from "@/lib/ui/surfaces";
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
          className="mb-6"
        />
        <div className="mb-8 flex flex-wrap gap-2" aria-label={`Popular ${config.noun} specialties`}>
          {config.popularSpecialties.map((s) => {
            const active = s === specialty;
            return (
              <Link
                key={s}
                href={active ? config.directoryPath : consultSpecialtyHref(role, s)}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  active
                    ? "border-brand bg-brand text-white"
                    : "border-slate-200 bg-white/80 text-slate-700 hover:border-brand/40 hover:text-brand-dark",
                )}
              >
                {s}
              </Link>
            );
          })}
        </div>
        <ConsultProviderDirectory
          role={role}
          initial={providers}
          cities={cities}
          city={city}
          specialty={specialty}
        />
      </PageSection>
      <PageSection variant="accent" spacing="default">
        <SectionHeader
          eyebrow="How it works"
          title={`Consult a ${config.noun} in three steps`}
          align="center"
          className="mx-auto"
        />
        <ol className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
          {[
            {
              icon: Search,
              title: "Browse & compare",
              body: `Filter by city and specialty, then compare qualifications, experience and reviews.`,
            },
            {
              icon: MessageCircle,
              title: "Request a consultation",
              body: `Send a request from the ${config.noun}'s profile — our team confirms a time that suits you.`,
            },
            {
              icon: Video,
              title: "Consult from home",
              body: "Meet over secure video and keep chatting with your provider after the consult.",
            },
          ].map((step, i) => (
            <li key={step.title} className={`p-6 ${surfaceCard}`}>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-muted text-brand">
                <step.icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand">
                Step {i + 1}
              </p>
              <h3 className="mt-1 font-display text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" className="w-full rounded-xl sm:w-auto" asChild>
            <a href={consultMatchWhatsAppHref(role, specialty)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Help me find a {config.noun}
            </a>
          </Button>
          <Button size="lg" variant="outline" className="w-full rounded-xl sm:w-auto" asChild>
            <Link href={config.registerPath}>
              <UserPlus className="h-4 w-4" />
              Join as a {config.noun}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
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
