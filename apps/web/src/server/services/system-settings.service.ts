import { connectDatabase, SystemSettingsModel } from "@zindagi/database";
import { STAFF_COMMISSION_CONFIG, SUNDAY_CONSULT_CONFIG } from "@zindagi/shared";

export type PlatformCommissionSettings = {
  defaultDoctorOnlineCommissionPercent: number;
  defaultDoctorHomeVisitCommissionPercent: number;
  defaultNurseCommissionPercent: number;
  updatedAt?: string;
};

export type SystemSettingsDto = PlatformCommissionSettings & {
  sundayConsultEnabled: boolean;
  sundayDefaultMaxSlots: number;
  sundaySlotDurationMins: number;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
};

function resolveDoctorOnlineDefault(doc?: {
  defaultDoctorOnlineCommissionPercent?: number | null;
  defaultDoctorCommissionPercent?: number | null;
}): number {
  return (
    doc?.defaultDoctorOnlineCommissionPercent ??
    doc?.defaultDoctorCommissionPercent ??
    STAFF_COMMISSION_CONFIG.defaultDoctorOnlinePercent
  );
}

function resolveDoctorHomeVisitDefault(doc?: {
  defaultDoctorHomeVisitCommissionPercent?: number | null;
  defaultDoctorCommissionPercent?: number | null;
}): number {
  return (
    doc?.defaultDoctorHomeVisitCommissionPercent ??
    doc?.defaultDoctorCommissionPercent ??
    STAFF_COMMISSION_CONFIG.defaultDoctorHomeVisitPercent
  );
}

const DEFAULTS: SystemSettingsDto = {
  sundayConsultEnabled: true,
  sundayDefaultMaxSlots: 10,
  sundaySlotDurationMins: SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins,
  maintenanceMode: false,
  defaultDoctorOnlineCommissionPercent: STAFF_COMMISSION_CONFIG.defaultDoctorOnlinePercent,
  defaultDoctorHomeVisitCommissionPercent: STAFF_COMMISSION_CONFIG.defaultDoctorHomeVisitPercent,
  defaultNurseCommissionPercent: STAFF_COMMISSION_CONFIG.defaultNursePercent,
};

const SETTINGS_CACHE_MS = 30_000;
let settingsCache: { at: number; value: SystemSettingsDto } | null = null;

function mapSettingsDoc(
  doc: {
    sundayConsultEnabled?: boolean;
    sundayDefaultMaxSlots?: number;
    sundaySlotDurationMins?: number;
    maintenanceMode?: boolean;
    maintenanceMessage?: string | null;
    defaultDoctorOnlineCommissionPercent?: number | null;
    defaultDoctorHomeVisitCommissionPercent?: number | null;
    defaultDoctorCommissionPercent?: number | null;
    defaultNurseCommissionPercent?: number | null;
    updatedAt?: Date;
  } | null,
): SystemSettingsDto {
  if (!doc) return DEFAULTS;

  return {
    sundayConsultEnabled: doc.sundayConsultEnabled ?? true,
    sundayDefaultMaxSlots: doc.sundayDefaultMaxSlots ?? 10,
    sundaySlotDurationMins:
      doc.sundaySlotDurationMins ?? SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins,
    maintenanceMode: doc.maintenanceMode ?? false,
    maintenanceMessage: doc.maintenanceMessage ?? undefined,
    defaultDoctorOnlineCommissionPercent: resolveDoctorOnlineDefault(doc),
    defaultDoctorHomeVisitCommissionPercent: resolveDoctorHomeVisitDefault(doc),
    defaultNurseCommissionPercent:
      doc.defaultNurseCommissionPercent ?? STAFF_COMMISSION_CONFIG.defaultNursePercent,
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

export async function getSystemSettings(): Promise<SystemSettingsDto> {
  const now = Date.now();
  if (settingsCache && now - settingsCache.at < SETTINGS_CACHE_MS) {
    return settingsCache.value;
  }

  await connectDatabase();
  const doc = await SystemSettingsModel.findOne({ key: "global" }).lean();
  const value = mapSettingsDoc(doc);

  settingsCache = { at: now, value };
  return value;
}

export async function getPlatformCommissionSettings(): Promise<PlatformCommissionSettings> {
  const settings = await getSystemSettings();
  return {
    defaultDoctorOnlineCommissionPercent: settings.defaultDoctorOnlineCommissionPercent,
    defaultDoctorHomeVisitCommissionPercent: settings.defaultDoctorHomeVisitCommissionPercent,
    defaultNurseCommissionPercent: settings.defaultNurseCommissionPercent,
    updatedAt: settings.updatedAt,
  };
}

export async function updateSystemSettings(
  patch: Partial<SystemSettingsDto>,
): Promise<SystemSettingsDto> {
  await connectDatabase();
  const doc = await SystemSettingsModel.findOneAndUpdate(
    { key: "global" },
    {
      $set: patch,
      $setOnInsert: { key: "global" },
    },
    { upsert: true, new: true },
  ).lean();

  settingsCache = null;

  return mapSettingsDoc(doc);
}

export async function updatePlatformCommissionSettings(
  patch: Partial<PlatformCommissionSettings>,
): Promise<PlatformCommissionSettings> {
  const settings = await updateSystemSettings(patch);
  return {
    defaultDoctorOnlineCommissionPercent: settings.defaultDoctorOnlineCommissionPercent,
    defaultDoctorHomeVisitCommissionPercent: settings.defaultDoctorHomeVisitCommissionPercent,
    defaultNurseCommissionPercent: settings.defaultNurseCommissionPercent,
    updatedAt: settings.updatedAt,
  };
}

export async function isSundayConsultGloballyEnabled(): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings.sundayConsultEnabled && !settings.maintenanceMode;
}
