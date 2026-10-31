import { notFound, permanentRedirect } from "next/navigation";
import { PageSection } from "@/components/layout/page-section";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { DoctorJsonLd } from "@/components/seo/doctor-json-ld";
import { DoctorProfileView } from "@/features/marketing/components/doctor-profile-view";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import {
  buildDoctorMetaDescription,
  buildDoctorSeoTitle,
  withDoctorSeoContent,
} from "@/lib/seo/doctor-seo";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PublicDoctorService } from "@/server/services/public-doctor.service";
import { ReviewService } from "@/server/services/review.service";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await PublicDoctorService.getPublicDoctor(slug);
  if (!doctor) {
    return { title: "Doctor not found" };
  }

  return buildPageMetadata({
    title: buildDoctorSeoTitle(doctor),
    description: buildDoctorMetaDescription(doctor),
    path: `/doctors/${doctor.slug}`,
    routeImages: true,
    openGraphType: "profile",
  });
}

export default async function DoctorProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const doctor = await PublicDoctorService.getPublicDoctor(slug);
  if (!doctor) notFound();

  const canonicalSlug = doctor.slug.toLowerCase();
  if (slug.toLowerCase() !== canonicalSlug) {
    permanentRedirect(`/doctors/${canonicalSlug}`);
  }

  const [{ reviews, total }, locale] = await Promise.all([
    ReviewService.listDoctorReviews(doctor.doctorId, { limit: 20 }),
    getLocale(),
  ]);
  const t = getDictionary(locale);
  const p = t.doctorProfile;
  // A factual summary and patient FAQs stand in for anything the doctor hasn't written, so
  // every profile has crawlable, quotable text (and matching JSON-LD).
  const profile = withDoctorSeoContent(doctor);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Doctors", path: "/doctors" },
          { name: doctor.name, path: `/doctors/${doctor.slug}` },
        ]}
      />
      <DoctorJsonLd doctor={profile} reviews={reviews} />
      <PageSection variant="brand" spacing="sm" flipBlur className="md:overflow-clip">
        <DoctorProfileView
          doctor={profile}
          reviews={reviews}
          reviewTotal={total}
          copy={{
            backToDoctors: p.backToDoctors,
            about: p.about,
            education: p.education,
            practicesAt: p.practicesAt,
            languages: p.languages,
            experience: p.experience,
            yearsExperience: p.yearsExperience,
            reviews: p.reviews,
            reviewsEmpty: p.reviewsEmpty,
            pmdcVerified: t.common.pmdc,
            videoConsult: p.videoConsult,
            perConsultation: p.perConsultation,
            shareProfile: p.shareProfile,
            linkCopied: p.linkCopied,
          }}
        />
      </PageSection>
    </>
  );
}
