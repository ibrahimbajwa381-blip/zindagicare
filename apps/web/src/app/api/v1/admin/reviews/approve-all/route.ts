import { withApiHandler } from "@/server/api/with-api-handler";
import { ReviewService } from "@/server/services/review.service";

export const POST = withApiHandler(
  async ({ session }) => {
    return ReviewService.approveAllPendingReviews(session!.user!.id);
  },
  {
    auth: true,
    roles: ["admin", "super_admin"],
  },
);
