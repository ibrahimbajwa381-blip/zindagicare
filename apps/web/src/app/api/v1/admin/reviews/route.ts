import type { NextRequest } from "next/server";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ReviewService } from "@/server/services/review.service";

export async function GET(req: NextRequest) {
  const visibility = req.nextUrl.searchParams.get("visibility");

  return withApiHandler(
    async () => {
      return ReviewService.listAdminReviews({
        visibility:
          visibility === "visible" || visibility === "hidden" ? visibility : "all",
      });
    },
    { auth: true, roles: ["admin", "super_admin"] },
  )(req);
}
