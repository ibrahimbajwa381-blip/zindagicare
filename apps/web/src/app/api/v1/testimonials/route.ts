import type { NextRequest } from "next/server";
import { submitTestimonialSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { TestimonialService } from "@/server/services/testimonial.service";

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  return withApiHandler(
    async () => {
      return TestimonialService.listPublic(limit && Number.isFinite(limit) ? limit : undefined);
    },
    { public: true },
  )(req);
}

export const POST = withApiHandler(
  async ({ session, body }) => {
    return TestimonialService.submitTestimonial(session!.user!.id, body);
  },
  {
    auth: true,
    roles: ["patient"],
    bodySchema: submitTestimonialSchema,
  },
);
