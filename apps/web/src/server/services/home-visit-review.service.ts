import {
  connectDatabase,
  HomeVisitModel,
  HomeVisitReviewModel,
  UserModel,
} from "@zindagi/database";
import { Types } from "mongoose";
import type { SubmitReviewInput } from "@zindagi/validators";
import {
  AppError,
  ErrorCodes,
  HOME_VISIT_PROVIDER_KINDS,
  HomeVisitStatuses,
  homeVisitProviderKind,
  type HomeVisitProviderKind,
} from "@zindagi/shared";
import type {
  AdminModerationReview,
  AdminModerationReviewList,
  AdminReviewModerationAction,
  AdminReviewVisibility,
} from "@/features/admin/types/admin-reviews";
import { mongoFilter } from "@/lib/mongo/query";
import { safeDisplayText } from "@/server/lib/decrypt-pii";

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

export type StaffReviewDto = {
  id: string;
  rating: number;
  comment?: string;
  patientName: string;
  createdAt: string;
};

export type StaffReviewSummary = {
  reviews: StaffReviewDto[];
  total: number;
  /** Average of all visible ratings, rounded to one decimal (0 when none). */
  ratingAvg: number;
};

/** Max rows returned to an admin moderation list. */
const ADMIN_LIST_LIMIT = 100;

/** Reviews still waiting for an admin decision (older rows may lack the flag). */
const PENDING_MODERATION = { isModerated: { $ne: true } };

const NOT_DELETED = { deletedAt: { $exists: false } };

function adminListFilter(providerKind: HomeVisitProviderKind, visibility: AdminReviewVisibility) {
  return {
    providerKind,
    ...NOT_DELETED,
    ...(visibility === "visible" ? { isVisible: true } : {}),
    ...(visibility === "hidden" ? { isVisible: false } : {}),
    ...(visibility === "pending" ? PENDING_MODERATION : {}),
  };
}

const MODERATION_UPDATES: Record<AdminReviewModerationAction, () => Record<string, unknown>> = {
  approve: () => ({}),
  hide: () => ({ isVisible: false }),
  show: () => ({ isVisible: true }),
  delete: () => ({ isVisible: false, deletedAt: new Date() }),
};

/** Display names by user id; names that can't be decrypted are left out. */
async function loadDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (!unique.length) return new Map();

  const users = await UserModel.find(mongoFilter({ _id: { $in: unique } }))
    .select("name")
    .lean();

  const names = new Map<string, string>();
  for (const user of users) {
    const name = safeDisplayText(user.name)?.trim().replace(/\s+/g, " ");
    if (name) names.set(user._id.toString(), name);
  }
  return names;
}

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
      providerKind: homeVisitProviderKind(String(visit.serviceType)),
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

  /** Visible patient reviews of a home-care provider (physiotherapist / nurse), newest first. */
  static async listStaffReviews(
    staffUserId: string,
    options: { limit?: number } = {},
  ): Promise<StaffReviewSummary> {
    await HomeVisitReviewService.ensureConnected();
    if (!Types.ObjectId.isValid(staffUserId)) return { reviews: [], total: 0, ratingAvg: 0 };

    const limit = Math.min(50, Math.max(1, options.limit ?? 10));
    const match = {
      staffUserId: new Types.ObjectId(staffUserId),
      isVisible: true,
      deletedAt: { $exists: false },
    };

    const [rows, [aggregate]] = await Promise.all([
      HomeVisitReviewModel.find(mongoFilter(match)).sort({ createdAt: -1 }).limit(limit).lean(),
      HomeVisitReviewModel.aggregate<{ avg: number; count: number }>([
        { $match: match },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
      ]),
    ]);

    const nameById = await loadDisplayNames(rows.map((row) => row.patientId.toString()));

    const total = aggregate?.count ?? 0;
    return {
      reviews: rows.map((row) => ({
        id: row._id.toString(),
        rating: row.rating,
        comment: row.comment ?? undefined,
        patientName: nameById.get(row.patientId.toString()) ?? "Patient",
        createdAt: (row.createdAt as Date).toISOString(),
      })),
      total,
      ratingAvg: total > 0 ? Math.round((aggregate!.avg + Number.EPSILON) * 10) / 10 : 0,
    };
  }

  /** Visible-review rating average and count per provider, for directory cards (one query). */
  static async ratingsByStaff(
    staffUserIds: string[],
  ): Promise<Map<string, { ratingAvg: number; total: number }>> {
    await HomeVisitReviewService.ensureConnected();
    const ids = [...new Set(staffUserIds)]
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (!ids.length) return new Map();

    const rows = await HomeVisitReviewModel.aggregate<{ _id: Types.ObjectId; avg: number; count: number }>([
      { $match: { staffUserId: { $in: ids }, isVisible: true, deletedAt: { $exists: false } } },
      { $group: { _id: "$staffUserId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    return new Map(
      rows.map((row) => [
        row._id.toString(),
        { ratingAvg: Math.round((row.avg + Number.EPSILON) * 10) / 10, total: row.count },
      ]),
    );
  }

  /** Admin moderation list for one provider type's home-visit reviews, newest first. */
  static async listAdminReviews(
    providerKind: HomeVisitProviderKind,
    options: { visibility?: AdminReviewVisibility } = {},
  ): Promise<AdminModerationReviewList> {
    await HomeVisitReviewService.ensureConnected();

    const filter = mongoFilter(adminListFilter(providerKind, options.visibility ?? "all"));
    const [rows, total] = await Promise.all([
      HomeVisitReviewModel.find(filter).sort({ createdAt: -1 }).limit(ADMIN_LIST_LIMIT).lean(),
      HomeVisitReviewModel.countDocuments(filter),
    ]);

    const names = await loadDisplayNames(
      rows.flatMap((row) => [row.patientId.toString(), row.staffUserId.toString()]),
    );

    const reviews: AdminModerationReview[] = rows.map((row) => ({
      id: row._id.toString(),
      rating: row.rating,
      comment: row.comment ?? undefined,
      isVisible: row.isVisible ?? true,
      isModerated: row.isModerated ?? false,
      createdAt: (row.createdAt as Date).toISOString(),
      patientName: names.get(row.patientId.toString()) ?? "Patient",
      providerName: names.get(row.staffUserId.toString()) ?? "Provider",
      source: "patient",
    }));

    return { reviews, total };
  }

  /** Approve, hide, show or soft-delete one review in a provider type's queue. */
  static async moderateReview(
    adminUserId: string,
    providerKind: HomeVisitProviderKind,
    reviewId: string,
    action: AdminReviewModerationAction,
  ) {
    await HomeVisitReviewService.ensureConnected();

    const review = Types.ObjectId.isValid(reviewId)
      ? await HomeVisitReviewModel.findOneAndUpdate(
          mongoFilter({ _id: reviewId, providerKind, ...NOT_DELETED }),
          {
            $set: {
              ...MODERATION_UPDATES[action](),
              isModerated: true,
              moderatedBy: new Types.ObjectId(adminUserId),
            },
          },
          { new: true },
        ).lean()
      : null;

    if (!review) {
      throw new AppError("Review not found", ErrorCodes.NOT_FOUND, 404);
    }

    return {
      id: review._id.toString(),
      isVisible: review.isVisible,
      isModerated: review.isModerated,
      deleted: Boolean(review.deletedAt),
    };
  }

  /** Mark every unmoderated review of a provider type as reviewed (keeps visibility). */
  static async approveAllPendingReviews(
    adminUserId: string,
    providerKind: HomeVisitProviderKind,
  ) {
    await HomeVisitReviewService.ensureConnected();

    const result = await HomeVisitReviewModel.updateMany(
      mongoFilter({ providerKind, ...NOT_DELETED, ...PENDING_MODERATION }),
      { $set: { isModerated: true, moderatedBy: new Types.ObjectId(adminUserId) } },
    );

    return { approved: result.modifiedCount ?? 0 };
  }

  /** Reviews waiting for moderation, per provider type (admin sidebar badges). */
  static async countPendingByProvider(): Promise<Record<HomeVisitProviderKind, number>> {
    await HomeVisitReviewService.ensureConnected();

    const rows = await HomeVisitReviewModel.aggregate<{ _id: HomeVisitProviderKind; count: number }>([
      {
        $match: {
          providerKind: { $in: [...HOME_VISIT_PROVIDER_KINDS] },
          ...NOT_DELETED,
          ...PENDING_MODERATION,
        },
      },
      { $group: { _id: "$providerKind", count: { $sum: 1 } } },
    ]);

    const counts = Object.fromEntries(
      HOME_VISIT_PROVIDER_KINDS.map((kind) => [kind, 0]),
    ) as Record<HomeVisitProviderKind, number>;
    for (const row of rows) counts[row._id] = row.count;
    return counts;
  }
}
