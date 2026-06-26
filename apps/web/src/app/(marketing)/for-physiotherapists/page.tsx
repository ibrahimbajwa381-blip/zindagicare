import type { Metadata } from "next";
import { ProviderOnboardingIntro } from "@/features/marketing/components/provider-onboarding-intro";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

const seo = marketingPageSeo.forPhysiotherapists;

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/for-physiotherapists",
  });
}

export default function ForPhysiotherapistsPage() {
  return <ProviderOnboardingIntro role="physiotherapist" />;
}
