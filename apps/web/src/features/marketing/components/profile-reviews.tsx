import { Star } from "lucide-react";
import { cn } from "@zindagi/shared";

export type ProfileReview = {
  id: string;
  rating: number;
  comment?: string;
  patientName: string;
  createdAt: string;
};

function formatReviewDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeZone: "Asia/Karachi",
  }).format(new Date(iso));
}

export function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-200",
          )}
        />
      ))}
    </span>
  );
}

/** "★★★★☆ 4.2 · 12 total" summary shown beside a reviews heading. */
export function RatingSummary({ ratingAvg, total }: { ratingAvg: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
      <RatingStars rating={ratingAvg} />
      {ratingAvg.toFixed(1)} · {total} total
    </span>
  );
}

export function ProfileReviewList({
  reviews,
  emptyText,
}: {
  reviews: ProfileReview[];
  emptyText: string;
}) {
  if (reviews.length === 0) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <ul className="space-y-4">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-xl border border-slate-100 bg-white/80 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">{review.patientName}</p>
              <p className="text-xs text-slate-400">{formatReviewDate(review.createdAt)}</p>
            </div>
            <RatingStars rating={review.rating} />
          </div>
          {review.comment && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{review.comment}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
