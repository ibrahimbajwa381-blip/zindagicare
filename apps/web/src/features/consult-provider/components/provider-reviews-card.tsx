import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ProfileReviewList,
  RatingSummary,
  type ProfileReview,
} from "@/features/marketing/components/profile-reviews";

/** Latest patient reviews on a provider's own dashboard, with a link to the full list. */
export function ProviderReviewsCard({
  reviews,
  total,
  ratingAvg,
  publicPath,
  emptyText,
}: {
  reviews: ProfileReview[];
  total: number;
  ratingAvg: number;
  publicPath: string | null;
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">Patient reviews</CardTitle>
        {total > 0 && <RatingSummary ratingAvg={ratingAvg} total={total} />}
      </CardHeader>
      <CardContent className="space-y-4">
        <ProfileReviewList reviews={reviews} emptyText={emptyText} />
        {publicPath && total > reviews.length && (
          <Button variant="outline" asChild>
            <Link href={`${publicPath}#reviews`}>See all reviews</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
