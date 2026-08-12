import { mockDoctors } from "../data/mock-doctors";
import { DoctorCard } from "./doctor-card";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";
import { formatQualificationsList } from "@/lib/doctors/qualifications";
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
          credentials: formatQualificationsList(
            doctor.medicalDegree,
            doctor.qualifications,
          ),
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
          credentials: formatQualificationsList(
            doctor.medicalDegree,
            doctor.qualifications,
          ),
        }))
  ).slice(0, 6);

  return (
    <PageSection variant="brand" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow={t.doctors.eyebrow}
        title={t.doctors.title}
        description={t.doctors.description}
      />
      <div className="mt-6 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
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
            credentials={doctor.credentials}
            pmdcLabel={t.common.pmdc}
          />
        ))}
      </div>
    </PageSection>
  );
}
