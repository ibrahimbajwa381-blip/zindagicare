import { notFound, permanentRedirect } from "next/navigation";
import { PageSection } from "@/components/layout/page-section";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { DoctorJsonLd } from "@/components/seo/doctor-json-ld";
import { DoctorProfileView } from "@/features/marketing/components/doctor-profile-view";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PublicDoctorService } from "@/server/services/public-doctor.service";
import { ReviewService } from "@/server/services/review.service";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/** Meta descriptions over ~155 chars get cut by search engines; end on a whole word. */
function truncateDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await PublicDoctorService.getPublicDoctor(slug);
  if (!doctor) {
    return { title: "Doctor not found" };
  }

  const specialty = doctor.specialties[0] ?? "Specialist";
  const canonicalSlug = doctor.slug;
  const summary = [doctor.portfolio.headline?.replace(/[.!?]+$/, ""), doctor.bio].filter(Boolean).join(". ");
  const description =
    (summary ? truncateDescription(summary) : undefined) ??
    `Book online doctor consultation with ${doctor.name}, ${specialty} in Pakistan on ZindagiCare. PMDC-verified, secure video consult from home.`;

  return buildPageMetadata({
    title: `${doctor.name} — ${specialty} | Online Consult Pakistan`,
    description,
    path: `/doctors/${canonicalSlug}`,
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

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Doctors", path: "/doctors" },
          { name: doctor.name, path: `/doctors/${doctor.slug}` },
        ]}
      />
      <DoctorJsonLd doctor={doctor} />
      <PageSection variant="brand" spacing="sm" flipBlur className="md:overflow-clip">
        <DoctorProfileView
          doctor={doctor}
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
