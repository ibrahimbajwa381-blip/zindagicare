import { adminTestimonialModerationSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { TestimonialService } from "@/server/services/testimonial.service";

export const POST = withApiHandler(
  async ({ session, body }) => {
    return TestimonialService.moderate(session!.user!.id, body.testimonialId, body.action);
  },
  {
    auth: true,
    roles: ["admin", "super_admin"],
    bodySchema: adminTestimonialModerationSchema,
  },
);
