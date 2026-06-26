import { DoctorBrowseSection } from "@/features/marketing/components/doctor-browse-section";
import { DoctorsConsultClient } from "@/features/marketing/components/doctors-consult-client";
import { OnlineConsultCta } from "@/features/marketing/components/online-consult-cta";
import { OnlineConsultFaq } from "@/features/marketing/components/online-consult-faq";
import { OnlineConsultHero } from "@/features/marketing/components/online-consult-hero";
import { OnlineConsultHowItWorks } from "@/features/marketing/components/online-consult-how-it-works";
import { OnlineConsultTrust } from "@/features/marketing/components/online-consult-trust";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { JsonLd } from "@/components/seo/json-ld";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildMedicalServiceSchema } from "@/lib/seo/schema";
import { marketingPageSeo } from "@/lib/seo/pages";
import { conditionDoctorPath, getConditionBySlug } from "@/lib/seo/conditions";
import { getSpecialtyBySlug, specialtyDoctorPath } from "@/lib/seo/specialties";

type PageProps = {
  searchParams: Promise<{ specialty?: string; condition?: string }>;
};

export function generateMetadata(): Metadata {
  const seo = marketingPageSeo.doctors;
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/doctors",
  });
}

export default async function DoctorsPage({ searchParams }: PageProps) {
  const { specialty: specialtySlug, condition: conditionSlug } = await searchParams;
  if (specialtySlug?.trim()) {
    const specialty = getSpecialtyBySlug(specialtySlug);
    if (specialty) {
      redirect(specialtyDoctorPath(specialty.slug));
    }
  }
  if (conditionSlug?.trim()) {
    const condition = getConditionBySlug(conditionSlug);
    if (condition) {
      redirect(conditionDoctorPath(condition.slug));
    }
  }

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Online consultation", path: "/doctors" },
        ]}
      />
      <JsonLd
        data={buildMedicalServiceSchema({
          name: marketingPageSeo.doctors.title,
          description: marketingPageSeo.doctors.description,
          path: "/doctors",
        })}
      />
      <OnlineConsultHero />
      <Suspense fallback={null}>
        <DoctorsConsultClient />
      </Suspense>
      <DoctorBrowseSection />
      <OnlineConsultHowItWorks />
      <OnlineConsultTrust />
      <OnlineConsultFaq />
      <OnlineConsultCta />
    </>
  );
}
