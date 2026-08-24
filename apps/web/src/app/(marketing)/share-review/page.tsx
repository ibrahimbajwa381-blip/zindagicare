import type { Metadata } from "next";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { PublicReviewForm } from "@/features/marketing/components/public-review-form";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = buildPageMetadata({
  title: `Share your review — ${siteConfig.name}`,
  description:
    "Tell us about your experience with ZindagiCare. Your review helps other patients and goes live on our website right away.",
  path: siteConfig.links.shareReview,
});

export default function ShareReviewPage() {
  return (
    <PageSection variant="soft" spacing="default">
      <div className="mx-auto max-w-2xl">
        <SectionHeader
          eyebrow="Patient stories"
          title="Share your experience"
          description="We'd love to hear about your visit or consultation. Your review will appear on our homepage right away."
          align="center"
          className="mb-8"
        />
        <PublicReviewForm />
      </div>
    </PageSection>
  );
}
