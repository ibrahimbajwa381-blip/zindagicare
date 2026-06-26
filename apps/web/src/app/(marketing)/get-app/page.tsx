import type { Metadata } from "next";
import { Suspense } from "react";
import { GetAppPage } from "@/features/pwa/components/get-app-page";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

const seo = marketingPageSeo.getApp;

export const metadata: Metadata = buildPageMetadata({
  title: seo.title,
  description: seo.description,
  path: "/get-app",
});

export default function GetAppRoutePage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading install guide…" />}>
      <GetAppPage />
    </Suspense>
  );
}
