import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { registerModel } from "../lib/register-model";

/** Singleton platform settings (key = "global"). */
const systemSettingsSchema = new Schema(
  {
    key: { type: String, default: "global", unique: true },
    sundayConsultEnabled: { type: Boolean, default: true },
    sundayDefaultMaxSlots: { type: Number, default: 10, min: 5, max: 20 },
    sundaySlotDurationMins: { type: Number, default: 10, min: 5, max: 60 },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, maxlength: 500 },
    /** Default doctor share for online/clinic paid consults (0–100). */
    defaultDoctorOnlineCommissionPercent: { type: Number, default: 70, min: 0, max: 100 },
    /** Default doctor share for in-house home visits (0–100). */
    defaultDoctorHomeVisitCommissionPercent: { type: Number, default: 70, min: 0, max: 100 },
    /** @deprecated Legacy single doctor default — migrated on read */
    defaultDoctorCommissionPercent: { type: Number, default: 70, min: 0, max: 100 },
    /** Default revenue share for nurses when profile has no override (0–100). */
    defaultNurseCommissionPercent: { type: Number, default: 70, min: 0, max: 100 },
    /** Default revenue share for physiotherapists when profile has no override (0–100). */
    defaultPhysiotherapistCommissionPercent: { type: Number, default: 70, min: 0, max: 100 },
    /** Default revenue share for herbalists when profile has no override (0–100). */
    defaultHerbalistCommissionPercent: { type: Number, default: 70, min: 0, max: 100 },
    /** Default revenue share for nutritionists when profile has no override (0–100). */
    defaultNutritionistCommissionPercent: { type: Number, default: 70, min: 0, max: 100 },
  },
  { timestamps: true },
);

export type SystemSettingsDocument = InferSchemaType<
  typeof systemSettingsSchema
> & { _id: Types.ObjectId };

export const SystemSettingsModel: Model<SystemSettingsDocument> =
  registerModel<SystemSettingsDocument>("SystemSettings", systemSettingsSchema);
