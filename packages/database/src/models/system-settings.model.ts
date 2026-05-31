import { Schema, type InferSchemaType, type Model } from "mongoose";
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
  },
  { timestamps: true },
);

export type SystemSettingsDocument = InferSchemaType<
  typeof systemSettingsSchema
> & { _id: Schema.Types.ObjectId };

export const SystemSettingsModel: Model<SystemSettingsDocument> =
  registerModel<SystemSettingsDocument>("SystemSettings", systemSettingsSchema);
