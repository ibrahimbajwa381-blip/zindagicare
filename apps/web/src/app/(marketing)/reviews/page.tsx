import type { Metadata } from "next";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { TestimonialCard } from "@/features/marketing/components/testimonial-card";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/config/site";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { TestimonialService } from "@/server/services/testimonial.service";

export const metadata: Metadata = buildPageMetadata({
  title: `Patient reviews — ${siteConfig.name}`,
  description:
    "Read real experiences from patients who consulted doctors, booked appointments, and received care at home with ZindagiCare.",
  path: siteConfig.links.reviews,
});

export default async function ReviewsPage() {
  const [locale, testimonials] = await Promise.all([
    getLocale(),
    TestimonialService.listPublic(50),
  ]);
  const t = getDictionary(locale).testimonials;

  return (
    <PageSection variant="soft" spacing="default">
      <SectionHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        align="center"
        className="mb-6"
      />
      <div className="mb-10 flex justify-center">
        <Button asChild size="sm" className="gap-1.5">
          <Link href={siteConfig.links.shareReview}>
            <PenLine className="h-3.5 w-3.5" />
            {t.addReview}
          </Link>
        </Button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((item) => (
          <TestimonialCard key={item.id} item={item} />
        ))}
      </div>
    </PageSection>
  );
}
