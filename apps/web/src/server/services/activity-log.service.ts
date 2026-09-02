import { ActivityEventModel, connectDatabase, UserModel } from "@zindagi/database";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";

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
    await connectDatabase();
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
    });
  } catch (err) {
    console.error("logActivity failed", err);
  }
}

export type ActivityFeedRow = {
  id: string;
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  status: "success" | "error";
  entityType: string | null;
  metadata: Record<string, unknown> | null;
  platform: string | null;
  path: string | null;
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
    ? await UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(userIds) } })).select("name").lean()
    : [];
  const nameById = new Map(
    users.map((u) => [u._id.toString(), safeDisplayText(u.name) ?? UNKNOWN]),
  );

  const events: ActivityFeedRow[] = rows.map((row) => ({
    id: row._id.toString(),
    userId: row.userId?.toString() ?? null,
    userName: row.userId ? nameById.get(row.userId.toString()) ?? UNKNOWN : "Guest",
    userRole: row.userRole ?? UNKNOWN,
    action: row.action,
    status: (row.status as "success" | "error") ?? "success",
    entityType: row.entityType ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    platform: row.platform ?? null,
    path: row.path ?? null,
    createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
  }));

  return { events, page, pageSize, total };
}

export type ActivitySummary = {
  totalEvents: number;
  last24h: number;
  errorRate7d: number;
  topActions: { action: string; count: number }[];
  topErrorActions: { action: string; count: number }[];
  byRole: { role: string; count: number }[];
  signups7d: number;
  visitors7d: number;
  visitorsNotConverted7d: number;
};

const PAGE_VIEW_ACTION = "page.view";
const SIGNUP_ACTION = "user.signup";

export async function getActivitySummary(): Promise<ActivitySummary> {
  await connectDatabase();

  const now = new Date();
  const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7dStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalEvents, last24h, window7d, signups7d, visitorIds7d, signupVisitorIds7d] =
    await Promise.all([
      ActivityEventModel.countDocuments({}),
      ActivityEventModel.countDocuments({ createdAt: { $gte: last24hStart } }),
      ActivityEventModel.find({ createdAt: { $gte: last7dStart } })
        .select("action status userRole")
        .lean(),
      ActivityEventModel.countDocuments({
        action: SIGNUP_ACTION,
        createdAt: { $gte: last7dStart },
      }),
      ActivityEventModel.distinct("visitorId", {
        action: PAGE_VIEW_ACTION,
        userId: { $exists: false },
        visitorId: { $exists: true },
        createdAt: { $gte: last7dStart },
      }),
      ActivityEventModel.distinct("visitorId", {
        action: SIGNUP_ACTION,
        visitorId: { $exists: true },
        createdAt: { $gte: last7dStart },
      }),
    ]);

  const actionCounts = new Map<string, number>();
  const errorActionCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();
  let errors = 0;

  for (const row of window7d) {
    actionCounts.set(row.action, (actionCounts.get(row.action) ?? 0) + 1);
    if (row.status === "error") {
      errors += 1;
      errorActionCounts.set(row.action, (errorActionCounts.get(row.action) ?? 0) + 1);
    }
    const role = row.userRole ?? "guest";
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
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

  const convertedVisitorIds = new Set(signupVisitorIds7d as string[]);
  const visitorsNotConverted7d = (visitorIds7d as string[]).filter(
    (id) => !convertedVisitorIds.has(id),
  ).length;

  return {
    totalEvents,
    last24h,
    errorRate7d: window7d.length ? errors / window7d.length : 0,
    topActions,
    topErrorActions,
    byRole,
    signups7d,
    visitors7d: (visitorIds7d as string[]).length,
    visitorsNotConverted7d,
  };
}
