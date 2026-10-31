import { adminTestimonialModerationSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { TestimonialService } from "@/server/services/testimonial.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const POST = withApiHandler(
  async ({ session, body }) => {
    return TestimonialService.moderate(session!.user!.id, body.testimonialId, body.action);
  },
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminTestimonialModerationSchema,
  },
);
