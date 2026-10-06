import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { FaqJsonLd } from "@/components/seo/faq-json-ld";
import { PhysiotherapistGuidePage } from "@/features/marketing/components/physiotherapist-guide-page";
import { PHYSIO_GUIDE_FAQ } from "@/features/marketing/data/physiotherapist-guide";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

const seo = marketingPageSeo.forPhysiotherapistsGuide;
const PATH = "/for-physiotherapists/guide";

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: PATH,
  });
}

export default function ForPhysiotherapistsGuidePage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "For physiotherapists", path: "/for-physiotherapists" },
          { name: "Physiotherapist guide", path: PATH },
        ]}
      />
      <FaqJsonLd items={[...PHYSIO_GUIDE_FAQ]} />
      <PhysiotherapistGuidePage />
    </>
  );
}
