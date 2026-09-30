import { Roles } from "@zindagi/shared";
import { parseAdminReviewVisibility } from "@/features/admin/types/admin-reviews";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ReviewService } from "@/server/services/review.service";

export const GET = withApiHandler(
  async ({ searchParams }) =>
    ReviewService.listAdminReviews({
      visibility: parseAdminReviewVisibility(searchParams.get("visibility")),
    }),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
