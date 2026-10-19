import { Types } from "mongoose";
import { z } from "zod";
import {
  connectDatabase,
  DoctorProfileModel,
  ManualEarningModel,
  StaffProfileModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  Roles,
  VerificationStatuses,
  calculateStaffNetEarnings,
} from "@zindagi/shared";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { recordAdminActivity, type AdminActivityActor } from "./admin-activity.service";
import { getDoctorCommissionRatesByProfileIds, resolveCommissionPercent } from "./commission.service";
import { getSystemSettings } from "./system-settings.service";

export const MANUAL_EARNING_PROVIDER_ROLES = ["doctor", "physiotherapist"] as const;
export const MANUAL_EARNING_SERVICE_TYPES = ["home_visit", "online_consult", "other"] as const;
export const MANUAL_EARNING_COLLECTED_BY = ["provider", "platform"] as const;

export type ManualEarningProviderRole = (typeof MANUAL_EARNING_PROVIDER_ROLES)[number];
export type ManualEarningServiceType = (typeof MANUAL_EARNING_SERVICE_TYPES)[number];
export type ManualEarningCollectedBy = (typeof MANUAL_EARNING_COLLECTED_BY)[number];

export const createManualEarningSchema = z.object({
  providerRole: z.enum(MANUAL_EARNING_PROVIDER_ROLES),
  providerProfileId: z.string().refine((v) => Types.ObjectId.isValid(v), "Pick a provider"),
  serviceType: z.enum(MANUAL_EARNING_SERVICE_TYPES),
  patientName: z.string().trim().max(120).optional(),
  grossAmount: z.number().positive("Amount must be greater than zero").max(10_000_000),
  providerPercent: z.number().min(0).max(100),
  collectedBy: z.enum(MANUAL_EARNING_COLLECTED_BY),
  note: z.string().trim().max(500).optional(),
  occurredAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
    .refine((v) => Date.parse(v) <= Date.now() + 24 * 60 * 60 * 1000, "Date can't be in the future"),
});

export type CreateManualEarningInput = z.infer<typeof createManualEarningSchema>;

export type ManualEarningProviderOption = {
  role: ManualEarningProviderRole;
  profileId: string;
  name: string;
  /** Default % the provider keeps, per service type. */
  defaultPercent: Record<ManualEarningServiceType, number>;
};

export type ManualEarningRow = {
  id: string;
  providerRole: ManualEarningProviderRole;
  providerProfileId: string;
  providerName: string;
  serviceType: ManualEarningServiceType;
  patientName?: string;
  grossAmount: number;
  providerPercent: number;
  providerEarnings: number;
  platformCommission: number;
  collectedBy: ManualEarningCollectedBy;
  note?: string;
  occurredAt: string;
  recordedByName: string;
};

const notDeleted = { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] };

async function resolveProviderName(
  role: ManualEarningProviderRole,
  profileIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!profileIds.length) return names;
  const profiles =
    role === "doctor"
      ? await DoctorProfileModel.find(mongoFilter({ _id: { $in: mongoObjectIds(profileIds) } }))
          .select("userId")
          .lean()
      : await StaffProfileModel.find(mongoFilter({ _id: { $in: mongoObjectIds(profileIds) } }))
          .select("userId")
          .lean();
  const userIds = profiles.map((p) => p.userId?.toString()).filter(Boolean) as string[];
  const users = userIds.length
    ? await UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(userIds) } }))
        .select("name")
        .lean()
    : [];
  const nameByUserId = new Map(users.map((u) => [u._id.toString(), safeDisplayText(u.name)]));
  for (const profile of profiles) {
    const name = nameByUserId.get(profile.userId?.toString() ?? "");
    names.set(profile._id.toString(), name ?? (role === "doctor" ? "Doctor" : "Physiotherapist"));
  }
  return names;
}

/** Approved doctors and physiotherapists the admin can attribute a manual entry to. */
export async function listManualEarningProviders(): Promise<ManualEarningProviderOption[]> {
  await connectDatabase();
  const [doctors, physios, settings] = await Promise.all([
    DoctorProfileModel.find(
      mongoFilter({ verificationStatus: VerificationStatuses.APPROVED, ...notDeleted }),
    )
      .select("_id")
      .lean(),
    StaffProfileModel.find(
      mongoFilter({
        staffType: Roles.PHYSIOTHERAPIST,
        verificationStatus: VerificationStatuses.APPROVED,
        ...notDeleted,
      }),
    )
      .select("_id commissionPercent")
      .lean(),
    getSystemSettings(),
  ]);

  const doctorIds = doctors.map((d) => d._id.toString());
  const physioIds = physios.map((p) => p._id.toString());
  const [doctorRates, doctorNames, physioNames] = await Promise.all([
    getDoctorCommissionRatesByProfileIds(doctorIds),
    resolveProviderName("doctor", doctorIds),
    resolveProviderName("physiotherapist", physioIds),
  ]);

  const options: ManualEarningProviderOption[] = [
    ...doctorIds.map((id) => {
      const rate = doctorRates.get(id) ?? {
        online: settings.defaultDoctorOnlineCommissionPercent,
        homeVisit: settings.defaultDoctorHomeVisitCommissionPercent,
      };
      return {
        role: "doctor" as const,
        profileId: id,
        name: doctorNames.get(id) ?? "Doctor",
        defaultPercent: {
          home_visit: rate.homeVisit,
          online_consult: rate.online,
          other: rate.homeVisit,
        },
      };
    }),
    ...physios.map((p) => {
      const id = p._id.toString();
      const percent = resolveCommissionPercent(
        p.commissionPercent,
        settings.defaultPhysiotherapistCommissionPercent,
      );
      return {
        role: "physiotherapist" as const,
        profileId: id,
        name: physioNames.get(id) ?? "Physiotherapist",
        defaultPercent: { home_visit: percent, online_consult: percent, other: percent },
      };
    }),
  ];

  return options.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listManualEarnings(): Promise<ManualEarningRow[]> {
  await connectDatabase();
  const entries = await ManualEarningModel.find(mongoFilter(notDeleted))
    .populate("recordedBy", "name")
    .sort({ occurredAt: -1 })
    .lean();

  const idsByRole = (role: ManualEarningProviderRole) => [
    ...new Set(
      entries.filter((e) => e.providerRole === role).map((e) => e.providerProfileId.toString()),
    ),
  ];
  const [doctorNames, physioNames] = await Promise.all([
    resolveProviderName("doctor", idsByRole("doctor")),
    resolveProviderName("physiotherapist", idsByRole("physiotherapist")),
  ]);

  return entries.map((entry) => {
    const role = entry.providerRole as ManualEarningProviderRole;
    const profileId = entry.providerProfileId.toString();
    const recordedBy = entry.recordedBy as { name?: string } | null;
    return {
      id: entry._id.toString(),
      providerRole: role,
      providerProfileId: profileId,
      providerName:
        (role === "doctor" ? doctorNames : physioNames).get(profileId) ??
        (role === "doctor" ? "Doctor" : "Physiotherapist"),
      serviceType: (entry.serviceType ?? "home_visit") as ManualEarningServiceType,
      patientName: entry.patientName ?? undefined,
      grossAmount: entry.grossAmount,
      providerPercent: entry.providerPercent,
      providerEarnings: entry.providerEarnings,
      platformCommission: entry.platformCommission,
      collectedBy: (entry.collectedBy ?? "provider") as ManualEarningCollectedBy,
      note: entry.note ?? undefined,
      occurredAt: entry.occurredAt.toISOString(),
      recordedByName: safeDisplayText(recordedBy?.name) ?? "Admin",
    };
  });
}

export async function createManualEarning(
  actor: AdminActivityActor,
  input: CreateManualEarningInput,
): Promise<{ id: string }> {
  await connectDatabase();

  const providerExists =
    input.providerRole === "doctor"
      ? await DoctorProfileModel.exists(mongoFilter({ _id: input.providerProfileId, ...notDeleted }))
      : await StaffProfileModel.exists(
          mongoFilter({
            _id: input.providerProfileId,
            staffType: Roles.PHYSIOTHERAPIST,
            ...notDeleted,
          }),
        );
  if (!providerExists) {
    throw new AppError("Provider not found", "NOT_FOUND", 404);
  }

  const grossAmount = Math.round(input.grossAmount);
  const providerEarnings = calculateStaffNetEarnings(grossAmount, input.providerPercent);
  const entry = await ManualEarningModel.create({
    providerRole: input.providerRole,
    providerProfileId: input.providerProfileId,
    serviceType: input.serviceType,
    patientName: input.patientName || undefined,
    grossAmount,
    providerPercent: input.providerPercent,
    providerEarnings,
    platformCommission: grossAmount - providerEarnings,
    collectedBy: input.collectedBy,
    note: input.note || undefined,
    occurredAt: new Date(input.occurredAt),
    recordedBy: actor.id,
  });

  await recordAdminActivity({
    actor,
    action: "manual_earning.create",
    entityType: "ManualEarning",
    entityId: entry._id.toString(),
    targetLabel: input.patientName || undefined,
    changes: {
      providerRole: input.providerRole,
      providerProfileId: input.providerProfileId,
      grossAmount,
      providerEarnings,
      collectedBy: input.collectedBy,
    },
  });

  return { id: entry._id.toString() };
}

export async function deleteManualEarning(
  actor: AdminActivityActor,
  id: string,
): Promise<{ id: string }> {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Entry not found", "NOT_FOUND", 404);
  }
  await connectDatabase();
  const entry = await ManualEarningModel.findOneAndUpdate(
    mongoFilter({ _id: id, ...notDeleted }),
    { $set: { deletedAt: new Date() } },
  ).lean();
  if (!entry) {
    throw new AppError("Entry not found", "NOT_FOUND", 404);
  }

  await recordAdminActivity({
    actor,
    action: "manual_earning.delete",
    entityType: "ManualEarning",
    entityId: id,
    targetLabel: entry.patientName ?? undefined,
    changes: { grossAmount: entry.grossAmount, providerProfileId: entry.providerProfileId.toString() },
  });

  return { id };
}
