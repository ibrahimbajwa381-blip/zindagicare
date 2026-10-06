import { Roles } from "@zindagi/shared";
import { parseAdminReviewVisibility } from "@/features/admin/types/admin-reviews";
import { homeVisitReviewProviderFromUrl } from "@/server/api/home-visit-review-provider";
import { withApiHandler } from "@/server/api/with-api-handler";
import { HomeVisitReviewService } from "@/server/services/home-visit-review.service";

export const GET = withApiHandler(
  async ({ req, searchParams }) =>
    HomeVisitReviewService.listAdminReviews(homeVisitReviewProviderFromUrl(req.url), {
      visibility: parseAdminReviewVisibility(searchParams.get("visibility")),
    }),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
