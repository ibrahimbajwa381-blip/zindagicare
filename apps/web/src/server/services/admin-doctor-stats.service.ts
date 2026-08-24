import { connectDatabase, DoctorProfileModel } from "@zindagi/database";
import { VerificationStatuses } from "@zindagi/shared";

export type AdminDoctorStats = {
  totals: {
    total: number;
    listed: number;
    approved: number;
    pending: number;
    rejected: number;
    restricted: number;
    pmdcVerified: number;
    videoConsultEnabled: number;
    urgentConsultEnabled: number;
    sundayConsultEnabled: number;
    homeVisitEnabled: number;
  };
  bySpecialty: { specialty: string; count: number }[];
  byCity: { city: string; count: number }[];
  byExperienceBand: { band: string; count: number }[];
  ratingDistribution: { band: string; count: number }[];
  feeStats: {
    avgConsultationFee: number;
    minConsultationFee: number;
    maxConsultationFee: number;
  };
  recentlyJoined: {
    id: string;
    name: string;
    specialty: string | null;
    city: string | null;
    verificationStatus: string;
    createdAt: string;
  }[];
};

export async function getAdminDoctorStats(): Promise<AdminDoctorStats> {
  await connectDatabase();

  const notDeleted = { deletedAt: null };

  const [
    total,
    listed,
    approved,
    pending,
    rejected,
    restricted,
    pmdcVerified,
    videoConsultEnabled,
    urgentConsultEnabled,
    sundayConsultEnabled,
    homeVisitEnabled,
    bySpecialtyAgg,
    byCityAgg,
    experienceAgg,
    ratingAgg,
    feeAgg,
    recentDocs,
  ] = await Promise.all([
    DoctorProfileModel.countDocuments(notDeleted),
    DoctorProfileModel.countDocuments({ ...notDeleted, isListed: true }),
    DoctorProfileModel.countDocuments({
      ...notDeleted,
      verificationStatus: VerificationStatuses.APPROVED,
    }),
    DoctorProfileModel.countDocuments({
      ...notDeleted,
      verificationStatus: VerificationStatuses.PENDING,
    }),
    DoctorProfileModel.countDocuments({
      ...notDeleted,
      verificationStatus: VerificationStatuses.REJECTED,
    }),
    DoctorProfileModel.countDocuments({
      ...notDeleted,
      verificationStatus: VerificationStatuses.RESTRICTED,
    }),
    DoctorProfileModel.countDocuments({ ...notDeleted, pmdcVerified: true }),
    DoctorProfileModel.countDocuments({ ...notDeleted, videoConsultEnabled: true }),
    DoctorProfileModel.countDocuments({ ...notDeleted, urgentConsultEnabled: true }),
    DoctorProfileModel.countDocuments({ ...notDeleted, sundayConsultEnabled: true }),
    DoctorProfileModel.countDocuments({ ...notDeleted, homeVisitEnabled: true }),
    DoctorProfileModel.aggregate([
      { $match: notDeleted },
      { $unwind: "$specialties" },
      { $group: { _id: "$specialties", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    DoctorProfileModel.aggregate([
      { $match: notDeleted },
      { $unwind: "$hospitals" },
      { $group: { _id: "$hospitals.city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
    DoctorProfileModel.aggregate([
      { $match: notDeleted },
      {
        $bucket: {
          groupBy: "$experienceYears",
          boundaries: [0, 3, 6, 11, 21, 1000],
          default: "unknown",
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    DoctorProfileModel.aggregate([
      { $match: notDeleted },
      {
        $bucket: {
          groupBy: "$ratingAvg",
          boundaries: [0, 1, 2, 3, 4, 5.01],
          default: "unrated",
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    DoctorProfileModel.aggregate([
      { $match: { ...notDeleted, consultationFee: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          avg: { $avg: "$consultationFee" },
          min: { $min: "$consultationFee" },
          max: { $max: "$consultationFee" },
        },
      },
    ]),
    DoctorProfileModel.find(notDeleted)
      .sort({ createdAt: -1 })
      .limit(8)
      .select("primarySpecialty verificationStatus hospitals createdAt userId")
      .populate("userId", "name")
      .lean(),
  ]);

  const experienceBandLabels: Record<string, string> = {
    "0": "0-2 years",
    "3": "3-5 years",
    "6": "6-10 years",
    "11": "11-20 years",
    "21": "21+ years",
    unknown: "Unknown",
  };

  const ratingBandLabels: Record<string, string> = {
    "0": "0-1",
    "1": "1-2",
    "2": "2-3",
    "3": "3-4",
    "4": "4-5",
    unrated: "Unrated",
  };

  const fee = feeAgg[0] ?? { avg: 0, min: 0, max: 0 };

  return {
    totals: {
      total,
      listed,
      approved,
      pending,
      rejected,
      restricted,
      pmdcVerified,
      videoConsultEnabled,
      urgentConsultEnabled,
      sundayConsultEnabled,
      homeVisitEnabled,
    },
    bySpecialty: bySpecialtyAgg.map((row) => ({
      specialty: row._id as string,
      count: row.count as number,
    })),
    byCity: byCityAgg.map((row) => ({
      city: row._id as string,
      count: row.count as number,
    })),
    byExperienceBand: experienceAgg.map((row) => ({
      band: experienceBandLabels[String(row._id)] ?? String(row._id),
      count: row.count as number,
    })),
    ratingDistribution: ratingAgg.map((row) => ({
      band: ratingBandLabels[String(row._id)] ?? String(row._id),
      count: row.count as number,
    })),
    feeStats: {
      avgConsultationFee: Math.round(fee.avg ?? 0),
      minConsultationFee: fee.min ?? 0,
      maxConsultationFee: fee.max ?? 0,
    },
    recentlyJoined: recentDocs.map((doc) => {
      const user = doc.userId as unknown as { name?: string } | null;
      return {
        id: String(doc._id),
        name: user?.name ?? "Unknown",
        specialty: doc.primarySpecialty ?? null,
        city: doc.hospitals?.[0]?.city ?? null,
        verificationStatus: doc.verificationStatus,
        createdAt: (doc.createdAt as Date).toISOString(),
      };
    }),
  };
}
