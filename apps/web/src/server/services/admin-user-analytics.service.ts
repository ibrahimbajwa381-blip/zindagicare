import { connectDatabase, UserModel } from "@zindagi/database";
import { normalizePhoneDigits, parsePhoneNumber, toPakistaniLocalPhone } from "@zindagi/validators";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { mongoFilter } from "@/lib/mongo/query";

const UNKNOWN = "Unknown";

type AgeGroup = "<18" | "18-25" | "26-35" | "36-45" | "46-60" | "60+" | "Unknown";

const AGE_GROUP_ORDER: AgeGroup[] = ["<18", "18-25", "26-35", "36-45", "46-60", "60+", "Unknown"];

function calculateAge(dateOfBirth?: Date | null): number | undefined {
  if (!dateOfBirth) return undefined;
  const ageMs = Date.now() - dateOfBirth.getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) return undefined;
  return Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));
}

function ageGroupFor(age?: number): AgeGroup {
  if (age === undefined) return "Unknown";
  if (age < 18) return "<18";
  if (age <= 25) return "18-25";
  if (age <= 35) return "26-35";
  if (age <= 45) return "36-45";
  if (age <= 60) return "46-60";
  return "60+";
}

function formatPhone(phone?: string | null): string | undefined {
  const revealed = safeDisplayText(phone);
  if (!revealed) return undefined;
  const digits = normalizePhoneDigits(revealed);
  if (!digits) return undefined;
  return parsePhoneNumber(revealed) ?? toPakistaniLocalPhone(digits);
}

export type UserAnalyticsSummary = {
  totalUsers: number;
  newToday: number;
  newThisWeek: number;
  newThisMonth: number;
  byRole: { role: string; count: number }[];
  byCity: { city: string; count: number }[];
  byAgeGroup: { ageGroup: AgeGroup; count: number }[];
};

export async function getUserAnalyticsSummary(): Promise<UserAnalyticsSummary> {
  await connectDatabase();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const users = await UserModel.find(mongoFilter({ deletedAt: null }))
    .select("roles metadata dateOfBirth createdAt")
    .lean();

  const roleCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  const ageGroupCounts = new Map<AgeGroup, number>();
  let newToday = 0;
  let newThisWeek = 0;
  let newThisMonth = 0;

  for (const user of users) {
    const roles = user.roles?.length ? user.roles : [UNKNOWN];
    for (const role of roles) {
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }

    const city = user.metadata?.city?.trim() || UNKNOWN;
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);

    const ageGroup = ageGroupFor(calculateAge(user.dateOfBirth));
    ageGroupCounts.set(ageGroup, (ageGroupCounts.get(ageGroup) ?? 0) + 1);

    const createdAt = user.createdAt;
    if (createdAt) {
      if (createdAt >= startOfToday) newToday += 1;
      if (createdAt >= startOfWeek) newThisWeek += 1;
      if (createdAt >= startOfMonth) newThisMonth += 1;
    }
  }

  const byRole = [...roleCounts.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);
  const byCity = [...cityCounts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
  const byAgeGroup = AGE_GROUP_ORDER.map((ageGroup) => ({
    ageGroup,
    count: ageGroupCounts.get(ageGroup) ?? 0,
  }));

  return {
    totalUsers: users.length,
    newToday,
    newThisWeek,
    newThisMonth,
    byRole,
    byCity,
    byAgeGroup,
  };
}

export type AdminUserAnalyticsRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  age: number | string;
  role: string;
  registeredAt: string;
};

export type AdminUserListResult = {
  users: AdminUserAnalyticsRow[];
  page: number;
  pageSize: number;
  total: number;
};

export async function listUsersForAdmin(params: {
  search?: string;
  role?: string;
  city?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminUserListResult> {
  await connectDatabase();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

  const filter: Record<string, unknown> = mongoFilter({ deletedAt: null });
  if (params.role) filter.roles = params.role;
  if (params.city) filter["metadata.city"] = params.city;

  // name/email/phone are encrypted at rest, so substring matching happens on a
  // bounded decrypted candidate set, not in the database — same approach as
  // listPatients in admin-patient.service.ts.
  const query = UserModel.find(filter)
    .select("name email phone roles metadata dateOfBirth createdAt")
    .sort({ createdAt: -1 });

  const search = params.search?.trim().toLowerCase();
  const candidates = search
    ? await query.limit(5000).lean()
    : await query.limit(5000).lean();

  const rows = candidates.map((user) => {
    const name = safeDisplayText(user.name) ?? UNKNOWN;
    const email = safeDisplayText(user.email) ?? UNKNOWN;
    const phone = formatPhone(user.phone) ?? UNKNOWN;
    const city = user.metadata?.city?.trim() || UNKNOWN;
    const age = calculateAge(user.dateOfBirth) ?? UNKNOWN;
    const role = user.roles?.[0] ?? UNKNOWN;
    return {
      id: user._id.toString(),
      name,
      email,
      phone,
      city,
      age,
      role,
      registeredAt: user.createdAt?.toISOString() ?? new Date(0).toISOString(),
      _needle: `${name} ${email} ${phone}`.toLowerCase(),
    };
  });

  const matched = search ? rows.filter((r) => r._needle.includes(search)) : rows;
  const total = matched.length;
  const start = (page - 1) * pageSize;
  const paged = matched.slice(start, start + pageSize).map(({ _needle, ...row }) => row);

  return { users: paged, page, pageSize, total };
}
