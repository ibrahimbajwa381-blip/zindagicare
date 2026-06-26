import type { Metadata } from "next";
import { UrgentConsultClient } from "@/features/urgent-consult/components/urgent-consult-client";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

const seo = marketingPageSeo.urgentCare;

export const metadata: Metadata = buildPageMetadata({
  title: seo.title,
  description: seo.description,
  path: "/urgent-care",
});

export default function UrgentCarePage() {
  return <UrgentConsultClient />;
}
