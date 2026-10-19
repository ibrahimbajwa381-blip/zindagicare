import type { NextRequest } from "next/server";
import {
  submitPlatformReviewSchema,
  type SubmitPlatformReviewInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ReviewService } from "@/server/services/review.service";

type Params = { params: Promise<{ appointmentId: string }> };

/** Patient rates ZindagiCare itself after a Sunday free consult. */
export async function POST(req: NextRequest, { params }: Params) {
  const { appointmentId } = await params;
  const afterVideoLeave = new URL(req.url).searchParams.get("afterVideoLeave") === "1";

  const handler = withApiHandler<SubmitPlatformReviewInput>(
    async ({ session, body }) =>
      ReviewService.submitPlatformReview(session!.user!.id, appointmentId, body, {
        afterVideoLeave,
      }),
    { auth: true, bodySchema: submitPlatformReviewSchema },
  );

  return handler(req as never);
}
