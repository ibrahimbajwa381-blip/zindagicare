import { withApiHandler } from "@/server/api/with-api-handler";
import { ReviewService } from "@/server/services/review.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const POST = withApiHandler(
  async ({ session }) => {
    return ReviewService.approveAllPendingReviews(session!.user!.id);
  },
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
  },
);
