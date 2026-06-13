import type { NextRequest } from "next/server";
import {
  submitReviewSchema,
  type SubmitReviewInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ReviewService } from "@/server/services/review.service";

type Params = { params: Promise<{ appointmentId: string }> };

function afterVideoLeaveFromRequest(req: Request) {
  return new URL(req.url).searchParams.get("afterVideoLeave") === "1";
}

export async function GET(req: NextRequest, { params }: Params) {
  const { appointmentId } = await params;
  const afterVideoLeave = afterVideoLeaveFromRequest(req);

  return withApiHandler(
    async ({ session }) => {
      return ReviewService.getPatientReviewState(session!.user!.id, appointmentId, {
        afterVideoLeave,
      });
    },
    { auth: true },
  )(req);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { appointmentId } = await params;
  const afterVideoLeave = afterVideoLeaveFromRequest(req);

  const handler = withApiHandler<SubmitReviewInput>(
    async ({ session, body }) => {
      return ReviewService.submitReview(
        session!.user!.id,
        appointmentId,
        body,
        { afterVideoLeave },
      );
    },
    { auth: true, bodySchema: submitReviewSchema },
  );

  return handler(req as never);
}
