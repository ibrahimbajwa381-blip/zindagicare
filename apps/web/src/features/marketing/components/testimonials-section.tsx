import Link from "next/link";
import { ArrowRight, PenLine } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { ScrollLinkedRow } from "@/features/marketing/components/scroll-linked-row";
import { ShareReviewLink } from "@/features/marketing/components/share-review-link";
import { TestimonialCard } from "@/features/marketing/components/testimonial-card";
import { siteConfig } from "@/config/site";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { TestimonialService } from "@/server/services/testimonial.service";

const PREVIEW_LIMIT = 6;

export async function TestimonialsSection() {
  const [locale, testimonials] = await Promise.all([
    getLocale(),
    TestimonialService.listPublic(PREVIEW_LIMIT),
  ]);

  if (testimonials.length === 0) return null;

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
      <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="sm" className="gap-1.5">
          <Link href={siteConfig.links.shareReview}>
            <PenLine className="h-3.5 w-3.5" />
            {t.addReview}
          </Link>
        </Button>
        <ShareReviewLink />
      </div>
      <ScrollLinkedRow className="sm:hidden">
        {testimonials.map((item) => (
          <div key={item.id} className="w-[82vw] max-w-sm shrink-0 snap-start [&>article]:h-full">
            <TestimonialCard item={item} />
          </div>
        ))}
      </ScrollLinkedRow>
      <div className="hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((item) => (
          <TestimonialCard key={item.id} item={item} />
        ))}
      </div>
      <div className="mt-8 flex justify-center">
        <Button asChild variant="outline" className="gap-1.5">
          <Link href={siteConfig.links.reviews}>
            {t.seeAll}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </PageSection>
  );
}
