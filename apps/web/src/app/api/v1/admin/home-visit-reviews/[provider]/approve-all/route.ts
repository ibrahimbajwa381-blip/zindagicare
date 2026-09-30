import { Roles } from "@zindagi/shared";
import { homeVisitReviewProviderFromUrl } from "@/server/api/home-visit-review-provider";
import { withApiHandler } from "@/server/api/with-api-handler";
import { HomeVisitReviewService } from "@/server/services/home-visit-review.service";

export const POST = withApiHandler(
  async ({ req, session }) =>
    HomeVisitReviewService.approveAllPendingReviews(
      session!.user!.id,
      homeVisitReviewProviderFromUrl(req.url),
    ),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
