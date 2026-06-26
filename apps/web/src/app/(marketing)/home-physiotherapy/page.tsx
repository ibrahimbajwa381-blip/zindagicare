import { HomePhysioBooking } from "@/features/marketing/components/home-physio-booking";
import { HomePhysioConditions } from "@/features/marketing/components/home-physio-conditions";
import { HomePhysioCta } from "@/features/marketing/components/home-physio-cta";
import { HomePhysioFaq } from "@/features/marketing/components/home-physio-faq";
import { HomePhysioHero } from "@/features/marketing/components/home-physio-hero";
import { HomePhysioHowItWorks } from "@/features/marketing/components/home-physio-how-it-works";
import { HomePhysioTrust } from "@/features/marketing/components/home-physio-trust";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

export function generateMetadata(): Metadata {
  const seo = marketingPageSeo.homePhysiotherapy;
  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/home-physiotherapy",
  });
}

export default function HomePhysiotherapyPage() {
  return (
    <>
      <HomePhysioHero />
      <HomePhysioBooking />
      <HomePhysioConditions />
      <HomePhysioHowItWorks />
      <HomePhysioTrust />
      <HomePhysioFaq />
      <HomePhysioCta />
    </>
  );
}
