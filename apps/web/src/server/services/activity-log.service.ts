import { ActivityEventModel, connectDatabase, UserModel } from "@zindagi/database";
import { highestRole, type Role } from "@zindagi/shared";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { getRequestGeo } from "@/server/lib/request-geo";

const UNKNOWN = "Unknown";

export type LogActivityInput = {
  userId?: string | null;
  userRole?: string | null;
  visitorId?: string | null;
  action: string;
  status?: "success" | "error";
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  platform?: "web" | "mobile";
  path?: string;
};

/**
 * Fire-and-forget activity logger. Never throws — a broken analytics write
 * must not break the feature it is instrumenting.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const [geo] = await Promise.all([getRequestGeo(), connectDatabase()]);
    await ActivityEventModel.create({
      userId: input.userId || undefined,
      userRole: input.userRole || undefined,
      visitorId: input.visitorId || undefined,
      action: input.action,
      status: input.status ?? "success",
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      platform: input.platform,
      path: input.path,
      ip: geo.ip,
      city: geo.city,
      region: geo.region,
      country: geo.country,
    });
  } catch (err) {
    console.error("logActivity failed", err);
  }
}

export type ActivityFeedRow = {
  id: string;
  /** Stable per-person key — `u:<userId>`, `v:<visitorId>` for guests, or `anon`. */
  actorKey: string;
  userId: string | null;
  visitorId: string | null;
  userName: string;
  userRole: string;
  action: string;
  status: "success" | "error";
  entityType: string | null;
  metadata: Record<string, unknown> | null;
  platform: string | null;
  path: string | null;
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  createdAt: string;
};

export type ActivityFeedResult = {
  events: ActivityFeedRow[];
  page: number;
  pageSize: number;
  total: number;
};

export async function listActivityForAdmin(params: {
  action?: string;
  role?: string;
  status?: string;
  userId?: string;
  visitorId?: string;
  page?: number;
  pageSize?: number;
}): Promise<ActivityFeedResult> {
  await connectDatabase();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

  const filter: Record<string, unknown> = mongoFilter({});
  if (params.action) filter.action = params.action;
  if (params.role === "guest") {
    filter.userId = { $exists: false };
  } else if (params.role) {
    filter.userRole = params.role;
  }
  if (params.status) filter.status = params.status;
  if (params.userId) filter.userId = params.userId;
  if (params.visitorId) filter.visitorId = params.visitorId;

  const [rows, total] = await Promise.all([
    ActivityEventModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ActivityEventModel.countDocuments(filter),
  ]);

  const userIds = [...new Set(rows.map((r) => r.userId?.toString()).filter(Boolean))] as string[];
  const users = userIds.length
    ? await UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(userIds) } }))
        .select("name roles")
        .lean()
    : [];
  const nameById = new Map(
    users.map((u) => [u._id.toString(), safeDisplayText(u.name) ?? UNKNOWN]),
  );
  // Show the user's current highest role (e.g. a patient who later became a
  // doctor shows as doctor), not whatever role was stamped on older events.
  const roleById = new Map(
    users.map((u) => [u._id.toString(), highestRole(u.roles as Role[] | undefined)]),
  );

  const events: ActivityFeedRow[] = rows.map((row) => ({
    id: row._id.toString(),
    actorKey: row.userId
      ? `u:${row.userId.toString()}`
      : row.visitorId
        ? `v:${row.visitorId}`
        : "anon",
    userId: row.userId?.toString() ?? null,
    visitorId: row.visitorId ?? null,
    userName: row.userId
      ? nameById.get(row.userId.toString()) ?? UNKNOWN
      : row.visitorId
        ? `Guest ${row.visitorId.slice(0, 4).toUpperCase()}`
        : "Guest",
    userRole: (row.userId && roleById.get(row.userId.toString())) || row.userRole || UNKNOWN,
    action: row.action,
    status: (row.status as "success" | "error") ?? "success",
    entityType: row.entityType ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    platform: row.platform ?? null,
    path: row.path ?? null,
    ip: row.ip ?? null,
    city: row.city ?? null,
    region: row.region ?? null,
    country: row.country ?? null,
    createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
  }));

  return { events, page, pageSize, total };
}

/** Time window the admin summary covers: last 24 hours, 7 days or 30 days. */
export const ACTIVITY_RANGES = ["day", "week", "month"] as const;
export type ActivityRange = (typeof ACTIVITY_RANGES)[number];

const RANGE_MS: Record<ActivityRange, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

/** Unknown or missing values fall back to the weekly window. */
export function parseActivityRange(value: string | null | undefined): ActivityRange {
  return ACTIVITY_RANGES.find((r) => r === value) ?? "week";
}

export type ActivitySummary = {
  range: ActivityRange;
  totalEvents: number;
  /** Events inside the selected range. */
  eventsInRange: number;
  errorRate: number;
  topActions: { action: string; count: number }[];
  topErrorActions: { action: string; count: number }[];
  byRole: { role: string; count: number }[];
  topCities: { city: string; count: number }[];
  signups: number;
  visitors: number;
  visitorsNotConverted: number;
  androidInstallsTotal: number;
  androidInstalls: number;
};

const PAGE_VIEW_ACTION = "page.view";
const SIGNUP_ACTION = "user.signup";
const PWA_INSTALL_ACTION = "pwa.install";

export async function getActivitySummary(
  range: ActivityRange = "week",
): Promise<ActivitySummary> {
  await connectDatabase();

  const rangeStart = new Date(Date.now() - RANGE_MS[range]);

  const [
    totalEvents,
    windowEvents,
    signups,
    visitorIds,
    signupVisitorIds,
    androidInstallsTotal,
    androidInstalls,
  ] = await Promise.all([
      ActivityEventModel.countDocuments({}),
      ActivityEventModel.find({ createdAt: { $gte: rangeStart } })
        .select("action status userRole city country")
        .lean(),
      ActivityEventModel.countDocuments({
        action: SIGNUP_ACTION,
        createdAt: { $gte: rangeStart },
      }),
      ActivityEventModel.distinct("visitorId", {
        action: PAGE_VIEW_ACTION,
        userId: { $exists: false },
        visitorId: { $exists: true },
        createdAt: { $gte: rangeStart },
      }),
      ActivityEventModel.distinct("visitorId", {
        action: SIGNUP_ACTION,
        visitorId: { $exists: true },
        createdAt: { $gte: rangeStart },
      }),
      ActivityEventModel.countDocuments({
        action: PWA_INSTALL_ACTION,
        "metadata.platform": "android",
      }),
      ActivityEventModel.countDocuments({
        action: PWA_INSTALL_ACTION,
        "metadata.platform": "android",
        createdAt: { $gte: rangeStart },
      }),
    ]);

  const actionCounts = new Map<string, number>();
  const errorActionCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  let errors = 0;

  for (const row of windowEvents) {
    actionCounts.set(row.action, (actionCounts.get(row.action) ?? 0) + 1);
    if (row.status === "error") {
      errors += 1;
      errorActionCounts.set(row.action, (errorActionCounts.get(row.action) ?? 0) + 1);
    }
    const role = row.userRole ?? "guest";
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    const city = row.city
      ? [row.city, row.country].filter(Boolean).join(", ")
      : row.country ?? "Unknown";
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }

  const topActions = [...actionCounts.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topErrorActions = [...errorActionCounts.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const byRole = [...roleCounts.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);

  const topCities = [...cityCounts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const convertedVisitorIds = new Set(signupVisitorIds as string[]);
  const visitorsNotConverted = (visitorIds as string[]).filter(
    (id) => !convertedVisitorIds.has(id),
  ).length;

  return {
    range,
    totalEvents,
    eventsInRange: windowEvents.length,
    errorRate: windowEvents.length ? errors / windowEvents.length : 0,
    topActions,
    topErrorActions,
    byRole,
    topCities,
    signups,
    visitors: (visitorIds as string[]).length,
    visitorsNotConverted,
    androidInstallsTotal,
    androidInstalls,
  };
}
