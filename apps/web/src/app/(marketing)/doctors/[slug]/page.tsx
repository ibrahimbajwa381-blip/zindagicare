import { notFound } from "next/navigation";
import { PageSection } from "@/components/layout/page-section";
import { DoctorProfileView } from "@/features/marketing/components/doctor-profile-view";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
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

  const specialty = doctor.specialties[0] ?? "Specialist";
  return {
    title: `${doctor.name} — ${specialty}`,
    description:
      doctor.bio?.slice(0, 160) ??
      `Book a paid video consultation with ${doctor.name}, ${specialty} in Lahore on ZindagiCare.`,
  };
}

export default async function DoctorProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const doctor = await PublicDoctorService.getPublicDoctor(slug);
  if (!doctor) notFound();

  const [{ reviews, total }, locale] = await Promise.all([
    ReviewService.listDoctorReviews(doctor.doctorId, { limit: 20 }),
    getLocale(),
  ]);
  const t = getDictionary(locale);
  const p = t.doctorProfile;

  return (
    <PageSection variant="brand" spacing="default" flipBlur>
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
        }}
      />
    </PageSection>
  );
}
