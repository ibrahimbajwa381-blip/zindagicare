import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { FaqJsonLd } from "@/components/seo/faq-json-ld";
import { DoctorGuidePage } from "@/features/marketing/components/doctor-guide-page";
import { DOCTOR_GUIDE_FAQ } from "@/features/marketing/data/doctor-guide";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

const seo = marketingPageSeo.forDoctorsGuide;
const PATH = "/for-doctors/guide";

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: PATH,
  });
}

export default function ForDoctorsGuidePage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "For doctors", path: "/for-doctors" },
          { name: "Doctor guide", path: PATH },
        ]}
      />
      <FaqJsonLd items={[...DOCTOR_GUIDE_FAQ]} />
      <DoctorGuidePage />
    </>
  );
}
