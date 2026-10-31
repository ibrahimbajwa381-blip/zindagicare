import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { adminReviewModerationSchema } from "@zindagi/validators";
import { homeVisitReviewProviderFromUrl } from "@/server/api/home-visit-review-provider";
import { withApiHandler } from "@/server/api/with-api-handler";
import { HomeVisitReviewService } from "@/server/services/home-visit-review.service";

export const POST = withApiHandler(
  async ({ req, session, body }) =>
    HomeVisitReviewService.moderateReview(
      session!.user!.id,
      homeVisitReviewProviderFromUrl(req.url),
      body.reviewId,
      body.action,
    ),
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminReviewModerationSchema,
  },
);
