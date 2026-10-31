import { JsonLd } from "@/components/seo/json-ld";
import { buildDoctorSeoTitle } from "@/lib/seo/doctor-seo";
import { buildFaqSchema, buildPhysicianSchema, buildProfilePageSchema } from "@/lib/seo/schema";
import type {
  DoctorReviewDto,
  PublicDoctorProfile,
} from "@/features/marketing/types/doctor-public";

type DoctorJsonLdProps = {
  /** Profile with SEO content applied (see `withDoctorSeoContent`). */
  doctor: PublicDoctorProfile;
  reviews?: DoctorReviewDto[];
};

export function DoctorJsonLd({ doctor, reviews }: DoctorJsonLdProps) {
  const physician = buildPhysicianSchema({ ...doctor, reviews });
  const profilePage = buildProfilePageSchema({
    path: `/doctors/${doctor.slug}`,
    name: buildDoctorSeoTitle(doctor),
    mainEntityId: physician["@id"],
    dateModified: doctor.portfolio.updatedAt,
  });
  const faqs = doctor.portfolio.faqs;
  return (
    <JsonLd
      data={[
        profilePage,
        physician,
        ...(faqs.length ? [buildFaqSchema(faqs.map((f) => ({ q: f.question, a: f.answer })))] : []),
      ]}
    />
  );
}
