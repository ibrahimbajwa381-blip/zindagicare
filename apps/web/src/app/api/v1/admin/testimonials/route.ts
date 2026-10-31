import type { NextRequest } from "next/server";
import { adminAddTestimonialSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { TestimonialService } from "@/server/services/testimonial.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export async function GET(req: NextRequest) {
  const visibility = req.nextUrl.searchParams.get("visibility");

  return withApiHandler(
    async () => {
      return TestimonialService.listAdmin({
        visibility: visibility === "visible" || visibility === "hidden" ? visibility : "all",
      });
    },
    { auth: true, roles: ADMIN_PANEL_ROLES },
  )(req);
}

export const POST = withApiHandler(
  async ({ session, body }) => {
    return TestimonialService.adminAddTestimonial(session!.user!.id, body);
  },
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminAddTestimonialSchema,
  },
);
