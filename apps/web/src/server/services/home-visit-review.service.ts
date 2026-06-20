import {
  connectDatabase,
  HomeVisitModel,
  HomeVisitReviewModel,
} from "@zindagi/database";
import type { SubmitReviewInput } from "@zindagi/validators";
import { AppError, ErrorCodes, HomeVisitStatuses } from "@zindagi/shared";
import { mongoFilter } from "@/lib/mongo/query";

export type HomeVisitReviewState = {
  canReview: boolean;
  staffName: string;
  review?: {
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
  };
};

function refId(ref: unknown): string | undefined {
  if (!ref) return undefined;
  if (typeof ref === "object" && ref !== null && "_id" in ref) {
    return (ref as { _id: { toString(): string } })._id.toString();
  }
  return (ref as { toString(): string }).toString();
}

export class HomeVisitReviewService {
  static async ensureConnected() {
    await connectDatabase();
  }

  static async getPatientReviewState(
    patientId: string,
    visitId: string,
  ): Promise<HomeVisitReviewState> {
    await HomeVisitReviewService.ensureConnected();

    const visit = await HomeVisitModel.findOne(
      mongoFilter({
        _id: visitId,
        patientId,
        deletedAt: { $exists: false },
      }),
    )
      .populate("assignedStaffId", "name")
      .lean();

    if (!visit) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }

    const staff = visit.assignedStaffId as { name?: string } | undefined;
    const staffName = staff?.name ?? "Your provider";

    const existing = await HomeVisitReviewModel.findOne(
      mongoFilter({ homeVisitId: visitId, deletedAt: { $exists: false } }),
    ).lean();

    if (existing) {
      return {
        canReview: false,
        staffName,
        review: {
          id: existing._id.toString(),
          rating: existing.rating,
          comment: existing.comment ?? undefined,
          createdAt: (existing.createdAt as Date).toISOString(),
        },
      };
    }

    return {
      canReview: visit.status === HomeVisitStatuses.COMPLETED,
      staffName,
    };
  }

  static async submitReview(
    patientId: string,
    visitId: string,
    input: SubmitReviewInput,
  ) {
    await HomeVisitReviewService.ensureConnected();

    const visit = await HomeVisitModel.findOne(
      mongoFilter({
        _id: visitId,
        patientId,
        deletedAt: { $exists: false },
      }),
    ).lean();

    if (!visit) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (visit.status !== HomeVisitStatuses.COMPLETED) {
      throw new AppError(
        "You can review after the visit is completed",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    const staffUserId = refId(visit.assignedStaffId);
    if (!staffUserId) {
      throw new AppError(
        "Visit has no assigned provider",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    const existing = await HomeVisitReviewModel.findOne(
      mongoFilter({ homeVisitId: visitId, deletedAt: { $exists: false } }),
    ).lean();

    if (existing) {
      throw new AppError("You already reviewed this visit", ErrorCodes.CONFLICT, 409);
    }

    const review = await HomeVisitReviewModel.create({
      homeVisitId: visitId,
      patientId,
      staffUserId,
      rating: input.rating,
      comment: input.comment?.trim() || undefined,
      isVisible: true,
    });

    return {
      id: review._id.toString(),
      homeVisitId: visitId,
      rating: review.rating,
      comment: review.comment ?? undefined,
      createdAt: review.createdAt.toISOString(),
    };
  }
}
