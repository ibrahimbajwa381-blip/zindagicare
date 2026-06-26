import type { Metadata } from "next";
import { ProviderOnboardingIntro } from "@/features/marketing/components/provider-onboarding-intro";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

const seo = marketingPageSeo.forDoctors;

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/for-doctors",
  });
}

export default function ForDoctorsPage() {
  return <ProviderOnboardingIntro role="doctor" />;
}
