import { ReviewModel, UserModel, connectDatabase } from "@zindagi/database";
import type { DoctorReviewDto } from "@/features/marketing/types/doctor-public";
import { mongoFilter } from "@/lib/mongo/query";

function maskPatientName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Patient";
  if (parts.length === 1) return `${parts[0][0]?.toUpperCase() ?? "P"}.`;
  return `${parts[0]} ${parts[parts.length - 1][0]?.toUpperCase() ?? ""}.`;
}

export class ReviewService {
  static async ensureConnected() {
    await connectDatabase();
  }

  static async listDoctorReviews(
    doctorProfileId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ reviews: DoctorReviewDto[]; total: number; hasMore: boolean }> {
    await ReviewService.ensureConnected();

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 10));
    const skip = (page - 1) * limit;

    const filter = mongoFilter({
      doctorId: doctorProfileId,
      isVisible: true,
      deletedAt: null,
    });

    const [rows, total] = await Promise.all([
      ReviewModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReviewModel.countDocuments(filter),
    ]);

    const patientIds = [...new Set(rows.map((row) => row.patientId.toString()))];
    const patients = patientIds.length
      ? await UserModel.find(mongoFilter({ _id: { $in: patientIds } }))
          .select("name")
          .lean()
      : [];
    const nameById = new Map(patients.map((p) => [p._id.toString(), p.name]));

    const reviews: DoctorReviewDto[] = rows.map((row) => ({
      id: row._id.toString(),
      rating: row.rating,
      comment: row.comment ?? undefined,
      patientName: maskPatientName(nameById.get(row.patientId.toString()) ?? "Patient"),
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      reviews,
      total,
      hasMore: skip + reviews.length < total,
    };
  }
}
