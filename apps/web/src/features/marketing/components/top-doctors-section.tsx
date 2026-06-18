import Link from "next/link";
import { siteConfig } from "@/config/site";
import { mockDoctors } from "../data/mock-doctors";
import { DoctorCard } from "./doctor-card";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "./section-header";
import { Button } from "@/components/ui/button";
import { getServerTranslations } from "@/i18n/server";
import { PublicDoctorService } from "@/server/services/public-doctor.service";
import { doctorProfilePath, nameToDoctorSlug } from "@/lib/doctors/profile-path";

export async function TopDoctorsSection() {
  const { t } = await getServerTranslations();
  const featured = await PublicDoctorService.getFeaturedDoctors(6);

  const doctors = (
    featured.length > 0
      ? featured.map((doctor) => ({
          key: doctor.doctorId,
          href: doctorProfilePath(doctor.slug, doctor.doctorId),
          name: doctor.name,
          specialty: doctor.specialty,
          hospital: doctor.hospital,
          rating: doctor.rating,
          reviews: doctor.reviews,
          fee: doctor.fee,
          pmdcVerified: doctor.pmdcVerified,
          imageUrl: doctor.imageUrl,
        }))
      : mockDoctors.map((doctor) => ({
          key: doctor.id,
          href: doctorProfilePath(nameToDoctorSlug(doctor.name)),
          name: doctor.name,
          specialty: doctor.specialty,
          hospital: doctor.hospital,
          rating: doctor.rating,
          reviews: doctor.reviews,
          fee: doctor.fee,
          pmdcVerified: doctor.pmdcVerified,
          imageUrl: doctor.imageUrl,
        }))
  ).slice(0, 6);

  return (
    <PageSection variant="brand" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow={t.doctors.eyebrow}
        title={t.doctors.title}
        description={t.doctors.description}
      />
      <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {doctors.map((doctor) => (
          <DoctorCard
            key={doctor.key}
            href={doctor.href}
            name={doctor.name}
            specialty={doctor.specialty}
            hospital={doctor.hospital}
            rating={doctor.rating}
            reviews={doctor.reviews}
            fee={doctor.fee}
            pmdcVerified={doctor.pmdcVerified}
            imageUrl={doctor.imageUrl}
            pmdcLabel={t.common.pmdc}
          />
        ))}
      </div>
      <Button
        variant="outline"
        className="mx-auto mt-8 flex h-12 w-full rounded-xl border-accent/30 bg-white/90 text-accent-dark backdrop-blur-sm hover:border-accent hover:bg-accent-muted sm:mt-10 sm:w-auto sm:px-8"
        asChild
      >
        <Link href={siteConfig.links.doctors}>{t.common.browseAll}</Link>
      </Button>
    </PageSection>
  );
}
