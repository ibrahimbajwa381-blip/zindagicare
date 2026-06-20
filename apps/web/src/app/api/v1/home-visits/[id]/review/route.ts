import type { NextRequest } from "next/server";
import {
  submitReviewSchema,
  type SubmitReviewInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { HomeVisitReviewService } from "@/server/services/home-visit-review.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;

  return withApiHandler(
    async ({ session }) => {
      return HomeVisitReviewService.getPatientReviewState(session!.user!.id, id);
    },
    { auth: true },
  )(req);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const handler = withApiHandler<SubmitReviewInput>(
    async ({ session, body }) => {
      return HomeVisitReviewService.submitReview(session!.user!.id, id, body);
    },
    { auth: true, bodySchema: submitReviewSchema },
  );

  return handler(req as never);
}
