import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { JsonLd } from "@/components/seo/json-ld";
import { DoctorsConsultClient } from "@/features/marketing/components/doctors-consult-client";
import {
  conditionDoctorPath,
  conditionSeoDescription,
  conditionSeoTitle,
  getConditionBySlug,
} from "@/lib/seo/conditions";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildMedicalServiceSchema } from "@/lib/seo/schema";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const condition = getConditionBySlug(slug);
  if (!condition) return { title: "Condition not found" };

  return buildPageMetadata({
    title: conditionSeoTitle(condition.label),
    description: conditionSeoDescription(condition.label, condition.specialty),
    path: conditionDoctorPath(slug),
  });
}

export default async function ConditionDoctorsPage({ params }: PageProps) {
  const { slug } = await params;
  const condition = getConditionBySlug(slug);
  if (!condition) notFound();

  const path = conditionDoctorPath(slug);
  const description = conditionSeoDescription(condition.label, condition.specialty);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Doctors", path: "/doctors" },
          { name: condition.label, path },
        ]}
      />
      <JsonLd
        data={buildMedicalServiceSchema({
          name: `${condition.label} Online Consultation`,
          description,
          path,
        })}
      />
      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle title={`${condition.label} — online consult`} description={description} />
      </PageSection>
      <Suspense fallback={null}>
        <DoctorsConsultClient initialSpecialty={condition.specialty} />
      </Suspense>
    </>
  );
}
