import {
  connectDatabase,
  AppointmentModel,
  PatientProfileModel,
  UserModel,
} from "@zindagi/database";
import { AppointmentStatuses, AppointmentTypes, Roles, STAFF_ROLES } from "@zindagi/shared";

export type AdminPatientStats = {
  totals: {
    total: number;
    active: number;
    banned: number;
    onboardingCompleted: number;
    withFamilyMembers: number;
    newThisMonth: number;
    newLast30Days: number;
  };
  byCity: { city: string; count: number }[];
  byGender: { gender: string; count: number }[];
  byBloodGroup: { bloodGroup: string; count: number }[];
  byAgeBand: { band: string; count: number }[];
  appointmentActivity: {
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    byType: { type: string; count: number }[];
  };
  growth: { month: string; count: number }[];
  topChronicConditions: { condition: string; count: number }[];
  recentlyJoined: {
    id: string;
    name: string;
    city: string | null;
    isActive: boolean;
    createdAt: string;
  }[];
};

const AGE_BAND_LABELS: Record<string, string> = {
  "0": "0-17",
  "18": "18-30",
  "31": "31-45",
  "46": "46-60",
  "61": "60+",
  unknown: "Unknown",
};

function calculateAgeBucket(dateOfBirth: unknown): number | "unknown" {
  if (!dateOfBirth) return "unknown";
  const dob = new Date(dateOfBirth as string | Date);
  if (Number.isNaN(dob.getTime())) return "unknown";
  const ageMs = Date.now() - dob.getTime();
  const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 18) return 0;
  if (age <= 30) return 18;
  if (age <= 45) return 31;
  if (age <= 60) return 46;
  return 61;
}

export async function getAdminPatientStats(): Promise<AdminPatientStats> {
  await connectDatabase();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const patientUserFilter = {
    roles: { $all: [Roles.PATIENT], $nin: STAFF_ROLES },
    deletedAt: null,
  };

  const [
    total,
    active,
    banned,
    onboardingCompleted,
    newThisMonth,
    newLast30Days,
    byCityAgg,
    growthAgg,
    userIdsForProfiles,
  ] = await Promise.all([
    UserModel.countDocuments(patientUserFilter),
    UserModel.countDocuments({ ...patientUserFilter, isActive: true }),
    UserModel.countDocuments({
      ...patientUserFilter,
      bannedUntil: { $gt: now },
    }),
    UserModel.countDocuments({ ...patientUserFilter, onboardingCompleted: true }),
    UserModel.countDocuments({ ...patientUserFilter, createdAt: { $gte: monthStart } }),
    UserModel.countDocuments({ ...patientUserFilter, createdAt: { $gte: last30Days } }),
    UserModel.aggregate([
      { $match: patientUserFilter },
      { $group: { _id: "$metadata.city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
    UserModel.aggregate([
      { $match: { ...patientUserFilter, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    UserModel.find(patientUserFilter).select("_id").lean(),
  ]);

  const patientUserIds = userIdsForProfiles.map((u) => String(u._id));

  const [
    genderAgg,
    bloodGroupAgg,
    ageAgg,
    chronicConditionsAgg,
    withFamilyMembers,
    appointmentTotals,
    appointmentByType,
    recentUsers,
  ] = await Promise.all([
    PatientProfileModel.aggregate([
      { $match: { userId: { $in: patientUserIds }, deletedAt: null } },
      { $group: { _id: "$gender", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    PatientProfileModel.aggregate([
      { $match: { userId: { $in: patientUserIds }, deletedAt: null } },
      { $group: { _id: "$bloodGroup", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    PatientProfileModel.find({ userId: { $in: patientUserIds }, deletedAt: null })
      .select("dateOfBirth")
      .lean(),
    PatientProfileModel.aggregate([
      { $match: { userId: { $in: patientUserIds }, deletedAt: null } },
      { $unwind: "$chronicConditions" },
      { $group: { _id: "$chronicConditions", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    PatientProfileModel.countDocuments({
      userId: { $in: patientUserIds },
      deletedAt: null,
      "emergencyContact.name": { $exists: true, $ne: null },
    }),
    AppointmentModel.aggregate([
      { $match: { patientId: { $in: patientUserIds }, deletedAt: null } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", AppointmentStatuses.COMPLETED] }, 1, 0],
            },
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ["$status", AppointmentStatuses.CANCELLED] }, 1, 0],
            },
          },
          noShow: {
            $sum: {
              $cond: [{ $eq: ["$status", AppointmentStatuses.NO_SHOW] }, 1, 0],
            },
          },
        },
      },
    ]),
    AppointmentModel.aggregate([
      { $match: { patientId: { $in: patientUserIds }, deletedAt: null } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    UserModel.find(patientUserFilter)
      .sort({ createdAt: -1 })
      .limit(8)
      .select("name isActive metadata createdAt")
      .lean(),
  ]);

  const ageBuckets = new Map<string, number>();
  for (const profile of ageAgg) {
    const bucket = calculateAgeBucket(profile.dateOfBirth);
    const key = String(bucket);
    ageBuckets.set(key, (ageBuckets.get(key) ?? 0) + 1);
  }

  const appointmentTypeLabels: Record<string, string> = {
    [AppointmentTypes.CLINIC]: "Clinic",
    [AppointmentTypes.ONLINE]: "Online",
    [AppointmentTypes.SUNDAY_FREE]: "Sunday free",
    [AppointmentTypes.HOME_VISIT]: "Home visit",
    [AppointmentTypes.URGENT_ONLINE]: "Urgent online",
  };

  const growthLabelFormatter = (key: string) => {
    const [year, month] = key.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  };

  const apptTotals = appointmentTotals[0] ?? {
    total: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  };

  return {
    totals: {
      total,
      active,
      banned,
      onboardingCompleted,
      withFamilyMembers,
      newThisMonth,
      newLast30Days,
    },
    byCity: byCityAgg
      .filter((row) => row._id)
      .map((row) => ({ city: row._id as string, count: row.count as number })),
    byGender: genderAgg.map((row) => ({
      gender: (row._id as string) ?? "Not specified",
      count: row.count as number,
    })),
    byBloodGroup: bloodGroupAgg.map((row) => ({
      bloodGroup: (row._id as string) ?? "Not specified",
      count: row.count as number,
    })),
    byAgeBand: Array.from(ageBuckets.entries())
      .sort((a, b) => (a[0] === "unknown" ? 1 : Number(a[0]) - Number(b[0])))
      .map(([key, count]) => ({
        band: AGE_BAND_LABELS[key] ?? key,
        count,
      })),
    appointmentActivity: {
      totalAppointments: apptTotals.total,
      completedAppointments: apptTotals.completed,
      cancelledAppointments: apptTotals.cancelled,
      noShowAppointments: apptTotals.noShow,
      byType: appointmentByType.map((row) => ({
        type: appointmentTypeLabels[row._id as string] ?? String(row._id),
        count: row.count as number,
      })),
    },
    growth: growthAgg.map((row) => ({
      month: growthLabelFormatter(row._id as string),
      count: row.count as number,
    })),
    topChronicConditions: chronicConditionsAgg.map((row) => ({
      condition: row._id as string,
      count: row.count as number,
    })),
    recentlyJoined: recentUsers.map((user) => ({
      id: String(user._id),
      name: user.name,
      city: user.metadata?.city ?? null,
      isActive: user.isActive ?? true,
      createdAt: (user.createdAt as Date).toISOString(),
    })),
  };
}
