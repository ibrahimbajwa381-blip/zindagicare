import { connectDatabase, AuditLogModel, UserModel } from "@zindagi/database";
import { mongoFilter } from "@/lib/mongo/query";

export type AdminActivityActor = {
  id: string;
  roles?: string[] | null;
  name?: string | null;
  email?: string | null;
};

/**
 * Records one admin-initiated action to the append-only audit trail. Never throws —
 * a logging failure must not block the admin mutation it's describing.
 *
 * `actor` can be a plain admin user id (for call sites that only have that on hand) —
 * their name/email/role are looked up for the snapshot fields in that case.
 */
export async function recordAdminActivity(params: {
  actor: AdminActivityActor | string;
  action: string;
  entityType: string;
  entityId: string;
  targetLabel?: string;
  changes?: Record<string, unknown>;
}): Promise<void> {
  try {
    await connectDatabase();

    const actor: AdminActivityActor =
      typeof params.actor === "string"
        ? await (async () => {
            const user = await UserModel.findById(params.actor as string)
              .select("name email roles")
              .lean();
            return {
              id: params.actor as string,
              roles: user?.roles,
              name: user?.name,
              email: user?.email,
            };
          })()
        : params.actor;

    await AuditLogModel.create({
      actorId: actor.id,
      actorRole: actor.roles?.[0],
      actorName: actor.name ?? undefined,
      actorEmail: actor.email ?? undefined,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      targetLabel: params.targetLabel,
      changes: params.changes,
    });
  } catch (error) {
    console.error("[recordAdminActivity] failed to write audit log entry", error);
  }
}

export type AdminActivityRow = {
  id: string;
  createdAt: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  targetLabel?: string;
  changes?: Record<string, unknown>;
};

export async function listAdminActivity(filters: {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  actorId?: string;
  from?: string;
  to?: string;
}): Promise<{ rows: AdminActivityRow[]; total: number; page: number; limit: number }> {
  await connectDatabase();

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));

  const query: Record<string, unknown> = {};
  if (filters.action) query.action = filters.action;
  if (filters.entityType) query.entityType = filters.entityType;
  if (filters.actorId) query.actorId = filters.actorId;
  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.$gte = new Date(filters.from);
    if (filters.to) createdAt.$lte = new Date(filters.to);
    query.createdAt = createdAt;
  }

  const [docs, total] = await Promise.all([
    AuditLogModel.find(mongoFilter(query))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLogModel.countDocuments(mongoFilter(query)),
  ]);

  return {
    rows: docs.map((d) => ({
      id: d._id.toString(),
      createdAt: (d.createdAt as Date).toISOString(),
      actorName: d.actorName ?? undefined,
      actorEmail: d.actorEmail ?? undefined,
      actorRole: d.actorRole ?? undefined,
      action: d.action,
      entityType: d.entityType,
      entityId: d.entityId?.toString() ?? "",
      targetLabel: d.targetLabel ?? undefined,
      changes: (d.changes as Record<string, unknown> | undefined) ?? undefined,
    })),
    total,
    page,
    limit,
  };
}

export async function getAdminActivityActionOptions(): Promise<string[]> {
  await connectDatabase();
  const actions = await AuditLogModel.distinct("action");
  return actions.sort();
}
