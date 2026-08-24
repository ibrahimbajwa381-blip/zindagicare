import Link from "next/link";
import { PenLine, Quote, Star } from "lucide-react";
import { cn } from "@zindagi/shared";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { ShareReviewLink } from "@/features/marketing/components/share-review-link";
import { surfaceCard } from "@/lib/ui/surfaces";
import { siteConfig } from "@/config/site";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { TestimonialService } from "@/server/services/testimonial.service";

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn(
            "h-4 w-4",
            index < rating ? "fill-amber-400 text-amber-400" : "text-slate-200",
          )}
        />
      ))}
    </span>
  );
}

export async function TestimonialsSection() {
  const [locale, testimonials] = await Promise.all([
    getLocale(),
    TestimonialService.listPublic(9),
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
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((item) => (
          <article
            key={item.id}
            className={cn(surfaceCard, "relative flex flex-col gap-3 p-6")}
          >
            <Quote className="h-6 w-6 text-brand-light" aria-hidden />
            {item.rating ? <RatingStars rating={item.rating} /> : null}
            <p className="flex-1 text-sm leading-relaxed text-slate-700">{item.content}</p>
            <p className="text-sm font-semibold text-foreground">{item.patientName}</p>
          </article>
        ))}
      </div>
    </PageSection>
  );
}
