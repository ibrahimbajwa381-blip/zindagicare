import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PageSection } from "@/components/layout/page-section";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { PhysiotherapistProfileView } from "@/features/marketing/components/physiotherapist-profile-view";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PublicPhysiotherapistService } from "@/server/services/public-physiotherapist.service";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const physio = await PublicPhysiotherapistService.get(slug);
  if (!physio) return { title: "Physiotherapist not found" };

  const specialty = physio.specialties[0] ?? "Physiotherapist";
  return buildPageMetadata({
    title: `${physio.name} — ${specialty} | Home Physiotherapy ${physio.city}`,
    description:
      physio.headline ??
      physio.bio?.slice(0, 155) ??
      `Book a home physiotherapy visit with ${physio.name}, ${specialty} in ${physio.city}, on ZindagiCare.`,
    path: `/physiotherapists/${physio.slug}`,
  });
}

export default async function PhysiotherapistProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const physio = await PublicPhysiotherapistService.get(slug);
  if (!physio) notFound();

  if (slug.toLowerCase() !== physio.slug) {
    permanentRedirect(`/physiotherapists/${physio.slug}`);
  }

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Physiotherapists", path: "/physiotherapists" },
          { name: physio.name, path: `/physiotherapists/${physio.slug}` },
        ]}
      />
      <PageSection variant="brand" spacing="default" flipBlur>
        <PhysiotherapistProfileView physio={physio} />
      </PageSection>
    </>
  );
}
