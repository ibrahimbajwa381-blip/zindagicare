import { JsonLd } from "@/components/seo/json-ld";
import { buildPhysicianSchema } from "@/lib/seo/schema";
import type { PublicDoctorProfile } from "@/features/marketing/types/doctor-public";

type DoctorJsonLdProps = {
  doctor: PublicDoctorProfile;
};

export function DoctorJsonLd({ doctor }: DoctorJsonLdProps) {
  return <JsonLd data={buildPhysicianSchema({ ...doctor, slug: doctor.slug })} />;
}
