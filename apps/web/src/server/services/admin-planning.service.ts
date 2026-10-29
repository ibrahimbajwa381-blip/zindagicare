import { Types } from "mongoose";
import {
  AppointmentModel,
  connectDatabase,
  PlanningItemModel,
  UserModel,
} from "@zindagi/database";
import { AppError, AppointmentStatuses, Roles } from "@zindagi/shared";
import type { PlanningItemInput } from "@zindagi/validators";
import { mongoFilter } from "@/lib/mongo/query";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import {
  currentMonthKey,
  type PartnerStage,
  type PartnerType,
  type PlanningBoard,
  type PlanningItemRow,
  type PlanningKind,
  type PlanningLiveMonth,
  type PlanningPriority,
  type PlanningStatus,
} from "@/features/admin/lib/planning";
import { recordAdminActivity, type AdminActivityActor } from "./admin-activity.service";

const notDeleted = { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] };

const PROVIDER_ROLES = [
  Roles.DOCTOR,
  Roles.NURSE,
  Roles.PHYSIOTHERAPIST,
  Roles.HERBALIST,
  Roles.NUTRITIONIST,
];

/** Fields an edit may clear by leaving them out. */
const OPTIONAL_FIELDS = [
  "description",
  "city",
  "owner",
  "startDate",
  "dueDate",
  "month",
  "metric",
  "unit",
  "targetValue",
  "currentValue",
  "partnerType",
  "stage",
  "contactName",
  "contactPhone",
  "achievedAt",
  "budget",
] as const;

/** YYYY-MM-DD (Pakistan) → midday Pakistan time, so it never shifts a day in either direction. */
function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00+05:00`);
}

function dateToKey(date: Date | null | undefined): string | undefined {
  return date ? date.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }) : undefined;
}

/** Start and end (exclusive) of a YYYY-MM month in Pakistan time. */
function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return {
    start: new Date(`${month}-01T00:00:00+05:00`),
    end: new Date(`${next}-01T00:00:00+05:00`),
  };
}

/** Builds the stored document from validated input, dropping empty strings. */
function toDocumentFields(input: PlanningItemInput) {
  const blank = (v: string | undefined) => (v ? v : undefined);
  return {
    kind: input.kind,
    title: input.title,
    description: blank(input.description),
    city: blank(input.city),
    status: input.status,
    priority: input.priority,
    owner: blank(input.owner),
    startDate: input.startDate ? dateFromKey(input.startDate) : undefined,
    dueDate: input.dueDate ? dateFromKey(input.dueDate) : undefined,
    month: input.month,
    metric: blank(input.metric),
    unit: blank(input.unit),
    targetValue: input.targetValue,
    currentValue: input.currentValue,
    partnerType: input.partnerType,
    stage: input.stage,
    contactName: blank(input.contactName),
    contactPhone: blank(input.contactPhone),
    achievedAt: input.achievedAt ? dateFromKey(input.achievedAt) : undefined,
    budget: input.budget,
  };
}

async function getLiveMonth(month: string): Promise<PlanningLiveMonth> {
  const { start, end } = monthRange(month);
  const [signups, completedConsults] = await Promise.all([
    UserModel.aggregate<{ _id: string | null; newPatients: number; newProviders: number }>([
      { $match: { createdAt: { $gte: start, $lt: end }, ...notDeleted } },
      {
        $project: {
          city: "$metadata.city",
          isPatient: { $in: [Roles.PATIENT, { $ifNull: ["$roles", []] }] },
          isProvider: {
            $gt: [{ $size: { $setIntersection: [{ $ifNull: ["$roles", []] }, PROVIDER_ROLES] } }, 0],
          },
        },
      },
      {
        $group: {
          _id: "$city",
          newPatients: { $sum: { $cond: ["$isPatient", 1, 0] } },
          newProviders: { $sum: { $cond: ["$isProvider", 1, 0] } },
        },
      },
    ]),
    AppointmentModel.countDocuments(
      mongoFilter({
        status: AppointmentStatuses.COMPLETED,
        completedAt: { $gte: start, $lt: end },
      }),
    ),
  ]);

  const byCity = signups
    .map((row) => ({
      city: row._id?.trim() || "Unknown",
      newPatients: row.newPatients,
      newProviders: row.newProviders,
    }))
    .filter((row) => row.newPatients + row.newProviders > 0)
    .sort((a, b) => b.newPatients + b.newProviders - (a.newPatients + a.newProviders));

  return {
    month,
    newPatients: byCity.reduce((sum, row) => sum + row.newPatients, 0),
    newProviders: byCity.reduce((sum, row) => sum + row.newProviders, 0),
    completedConsults,
    byCity,
  };
}

export async function getPlanningBoard(month = currentMonthKey()): Promise<PlanningBoard> {
  await connectDatabase();
  const [items, live] = await Promise.all([
    PlanningItemModel.find(mongoFilter(notDeleted))
      .populate("createdBy", "name")
      .sort({ updatedAt: -1 })
      .lean(),
    getLiveMonth(month),
  ]);

  const rows: PlanningItemRow[] = items.map((item) => {
    const createdBy = item.createdBy as { name?: string } | null;
    return {
      id: item._id.toString(),
      kind: item.kind as PlanningKind,
      title: item.title,
      description: item.description ?? undefined,
      city: item.city ?? undefined,
      status: (item.status ?? "planned") as PlanningStatus,
      priority: (item.priority ?? "medium") as PlanningPriority,
      owner: item.owner ?? undefined,
      startDate: dateToKey(item.startDate),
      dueDate: dateToKey(item.dueDate),
      month: item.month ?? undefined,
      metric: item.metric ?? undefined,
      unit: item.unit ?? undefined,
      targetValue: item.targetValue ?? undefined,
      currentValue: item.currentValue ?? undefined,
      partnerType: (item.partnerType ?? undefined) as PartnerType | undefined,
      stage: (item.stage ?? undefined) as PartnerStage | undefined,
      contactName: item.contactName ?? undefined,
      contactPhone: item.contactPhone ?? undefined,
      achievedAt: dateToKey(item.achievedAt),
      budget: item.budget ?? undefined,
      createdByName: safeDisplayText(createdBy?.name) ?? "Admin",
      updatedAt: (item as { updatedAt?: Date }).updatedAt?.toISOString() ?? new Date(0).toISOString(),
    };
  });

  return { items: rows, live };
}

export async function createPlanningItem(
  actor: AdminActivityActor,
  input: PlanningItemInput,
): Promise<{ id: string }> {
  await connectDatabase();
  const item = await PlanningItemModel.create({
    ...toDocumentFields(input),
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await recordAdminActivity({
    actor,
    action: "planning.create",
    entityType: "PlanningItem",
    entityId: item._id.toString(),
    targetLabel: input.title,
    changes: { kind: input.kind },
  });

  return { id: item._id.toString() };
}

export async function updatePlanningItem(
  actor: AdminActivityActor,
  id: string,
  input: PlanningItemInput,
): Promise<{ id: string }> {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Entry not found", "NOT_FOUND", 404);
  }
  await connectDatabase();

  const fields = toDocumentFields(input);
  const $set: Record<string, unknown> = { updatedBy: actor.id };
  const $unset: Record<string, ""> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) $set[key] = value;
    else if ((OPTIONAL_FIELDS as readonly string[]).includes(key)) $unset[key] = "";
  }

  const updated = await PlanningItemModel.findOneAndUpdate(
    mongoFilter({ _id: id, ...notDeleted }),
    Object.keys($unset).length ? { $set, $unset } : { $set },
    { runValidators: true },
  ).lean();
  if (!updated) {
    throw new AppError("Entry not found", "NOT_FOUND", 404);
  }

  await recordAdminActivity({
    actor,
    action: "planning.update",
    entityType: "PlanningItem",
    entityId: id,
    targetLabel: input.title,
    changes: { kind: input.kind, status: input.status },
  });

  return { id };
}

export async function deletePlanningItem(
  actor: AdminActivityActor,
  id: string,
): Promise<{ id: string }> {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Entry not found", "NOT_FOUND", 404);
  }
  await connectDatabase();
  const item = await PlanningItemModel.findOneAndUpdate(
    mongoFilter({ _id: id, ...notDeleted }),
    { $set: { deletedAt: new Date(), updatedBy: actor.id } },
  ).lean();
  if (!item) {
    throw new AppError("Entry not found", "NOT_FOUND", 404);
  }

  await recordAdminActivity({
    actor,
    action: "planning.delete",
    entityType: "PlanningItem",
    entityId: id,
    targetLabel: item.title,
    changes: { kind: item.kind },
  });

  return { id };
}
