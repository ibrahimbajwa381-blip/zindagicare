import { JsonLd } from "@/components/seo/json-ld";
import { buildFaqSchema, buildPhysicianSchema } from "@/lib/seo/schema";
import type { PublicDoctorProfile } from "@/features/marketing/types/doctor-public";

type DoctorJsonLdProps = {
  doctor: PublicDoctorProfile;
};

export function DoctorJsonLd({ doctor }: DoctorJsonLdProps) {
  const physician = buildPhysicianSchema({ ...doctor, slug: doctor.slug });
  const faqs = doctor.portfolio.faqs;
  return (
    <JsonLd
      data={
        faqs.length
          ? [physician, buildFaqSchema(faqs.map((f) => ({ q: f.question, a: f.answer })))]
          : physician
      }
    />
  );
}
