import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PageSection } from "@/components/layout/page-section";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { NurseProfileView } from "@/features/marketing/components/nurse-profile-view";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { HomeVisitReviewService } from "@/server/services/home-visit-review.service";
import { PublicNurseService } from "@/server/services/public-nurse.service";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const nurse = await PublicNurseService.get(slug);
  if (!nurse) return { title: "Nurse not found" };

  const specialty = nurse.specialties[0] ?? "Nurse";
  return buildPageMetadata({
    title: `${nurse.name} — ${specialty} | Home Nursing ${nurse.city}`,
    description:
      nurse.headline ??
      nurse.bio?.slice(0, 155) ??
      `Book a home nursing visit with ${nurse.name}, ${specialty} in ${nurse.city}, on ZindagiCare.`,
    path: `/nurses/${nurse.slug}`,
  });
}

export default async function NurseProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const nurse = await PublicNurseService.get(slug);
  if (!nurse) notFound();

  if (slug.toLowerCase() !== nurse.slug) {
    permanentRedirect(`/nurses/${nurse.slug}`);
  }

  const reviews = await HomeVisitReviewService.listStaffReviews(nurse.id, { limit: 20 });

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Nurses", path: "/nurses" },
          { name: nurse.name, path: `/nurses/${nurse.slug}` },
        ]}
      />
      <PageSection variant="brand" spacing="sm" flipBlur className="md:overflow-clip">
        <NurseProfileView nurse={nurse} reviews={reviews} />
      </PageSection>
    </>
  );
}
