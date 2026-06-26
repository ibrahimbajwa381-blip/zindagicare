import type { Metadata } from "next";
import { ProviderOnboardingIntro } from "@/features/marketing/components/provider-onboarding-intro";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

const seo = marketingPageSeo.forNurses;

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/for-nurses",
  });
}

export default function ForNursesPage() {
  return <ProviderOnboardingIntro role="nurse" />;
}
