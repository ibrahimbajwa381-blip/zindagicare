import { connectDatabase, SystemSettingsModel } from "@zindagi/database";
import { SUNDAY_CONSULT_CONFIG } from "@zindagi/shared";

export type SystemSettingsDto = {
  sundayConsultEnabled: boolean;
  sundayDefaultMaxSlots: number;
  sundaySlotDurationMins: number;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  updatedAt?: string;
};

const DEFAULTS: SystemSettingsDto = {
  sundayConsultEnabled: true,
  sundayDefaultMaxSlots: 10,
  sundaySlotDurationMins: SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins,
  maintenanceMode: false,
};

const SETTINGS_CACHE_MS = 30_000;
let settingsCache: { at: number; value: SystemSettingsDto } | null = null;

export async function getSystemSettings(): Promise<SystemSettingsDto> {
  const now = Date.now();
  if (settingsCache && now - settingsCache.at < SETTINGS_CACHE_MS) {
    return settingsCache.value;
  }

  await connectDatabase();
  const doc = await SystemSettingsModel.findOne({ key: "global" }).lean();
  const value: SystemSettingsDto = !doc
    ? DEFAULTS
    : {
        sundayConsultEnabled: doc.sundayConsultEnabled ?? true,
        sundayDefaultMaxSlots: doc.sundayDefaultMaxSlots ?? 10,
        sundaySlotDurationMins:
          doc.sundaySlotDurationMins ?? SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins,
        maintenanceMode: doc.maintenanceMode ?? false,
        maintenanceMessage: doc.maintenanceMessage ?? undefined,
        updatedAt: doc.updatedAt?.toISOString(),
      };

  settingsCache = { at: now, value };
  return value;
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

  return {
    sundayConsultEnabled: doc!.sundayConsultEnabled ?? true,
    sundayDefaultMaxSlots: doc!.sundayDefaultMaxSlots ?? 10,
    sundaySlotDurationMins:
      doc!.sundaySlotDurationMins ??
      SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins,
    maintenanceMode: doc!.maintenanceMode ?? false,
    maintenanceMessage: doc!.maintenanceMessage ?? undefined,
    updatedAt: doc!.updatedAt?.toISOString(),
  };
}

export async function isSundayConsultGloballyEnabled(): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings.sundayConsultEnabled && !settings.maintenanceMode;
}
