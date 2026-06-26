import type { Metadata } from "next";
import { SundayBanner } from "@/features/marketing/components/sunday-banner";
import { SundayConsultClient } from "@/features/sunday-consult/components/sunday-consult-client";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

const seo = marketingPageSeo.sundayConsult;

export const metadata: Metadata = buildPageMetadata({
  title: seo.title,
  description: seo.description,
  path: "/sunday-consult",
});

export default function SundayConsultPage() {
  return (
    <>
      <SundayBanner />
      <SundayConsultClient />
    </>
  );
}
