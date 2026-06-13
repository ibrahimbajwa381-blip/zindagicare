import { adminReviewModerationSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ReviewService } from "@/server/services/review.service";

export const POST = withApiHandler(
  async ({ session, body }) => {
    return ReviewService.moderateReview(
      session!.user!.id,
      body.reviewId,
      body.action,
    );
  },
  {
    auth: true,
    roles: ["admin", "super_admin"],
    bodySchema: adminReviewModerationSchema,
  },
);
