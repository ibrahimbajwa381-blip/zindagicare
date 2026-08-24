import { publicSubmitTestimonialSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { TestimonialService } from "@/server/services/testimonial.service";

export const POST = withApiHandler(
  async ({ body }) => {
    return TestimonialService.submitPublicTestimonial(body);
  },
  {
    public: true,
    bodySchema: publicSubmitTestimonialSchema,
  },
);
