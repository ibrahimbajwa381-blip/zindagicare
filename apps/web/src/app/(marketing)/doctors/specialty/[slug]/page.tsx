import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { JsonLd } from "@/components/seo/json-ld";
import { DoctorsConsultClient } from "@/features/marketing/components/doctors-consult-client";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildMedicalServiceSchema } from "@/lib/seo/schema";
import {
  getSpecialtyBySlug,
  specialtyDoctorPath,
  specialtySeoDescription,
  specialtySeoTitle,
} from "@/lib/seo/specialties";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const specialty = getSpecialtyBySlug(slug);
  if (!specialty) return { title: "Specialty not found" };

  return buildPageMetadata({
    title: specialtySeoTitle(specialty.label),
    description: specialtySeoDescription(specialty.label),
    path: specialtyDoctorPath(slug),
  });
}

export default async function SpecialtyDoctorsPage({ params }: PageProps) {
  const { slug } = await params;
  const specialty = getSpecialtyBySlug(slug);
  if (!specialty) notFound();

  const path = specialtyDoctorPath(slug);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Doctors", path: "/doctors" },
          { name: specialty.label, path },
        ]}
      />
      <JsonLd
        data={buildMedicalServiceSchema({
          name: `${specialty.label} Online Consultation`,
          description: specialtySeoDescription(specialty.label),
          path,
        })}
      />
      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle
          title={`${specialty.label} in Lahore`}
          description={specialtySeoDescription(specialty.label)}
        />
      </PageSection>
      <Suspense fallback={null}>
        <DoctorsConsultClient initialSpecialty={specialty.label} />
      </Suspense>
    </>
  );
}
