import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * ManualEarning — admin-recorded revenue from a service booked outside the app
 * (e.g. a doctor/physio home visit arranged over a WhatsApp call). Counted toward
 * ZindagiCare's platform earnings alongside in-app consults and visits.
 */
const manualEarningSchema = new Schema(
  {
    providerRole: {
      type: String,
      enum: ["doctor", "physiotherapist"],
      required: true,
      index: true,
    },
    /** DoctorProfile id for doctors, StaffProfile id for physiotherapists. */
    providerProfileId: { type: Schema.Types.ObjectId, required: true, index: true },
    serviceType: {
      type: String,
      enum: ["home_visit", "online_consult", "other"],
      default: "home_visit",
    },
    patientName: { type: String, maxlength: 120 },
    /** What the patient paid in total. */
    grossAmount: { type: Number, required: true, min: 0 },
    /** % of the gross the provider keeps, snapshotted when the entry was recorded. */
    providerPercent: { type: Number, required: true, min: 0, max: 100 },
    providerEarnings: { type: Number, required: true, min: 0 },
    platformCommission: { type: Number, required: true, min: 0 },
    /** Who received the patient's money — decides who owes whom the other share. */
    collectedBy: {
      type: String,
      enum: ["provider", "platform"],
      default: "provider",
    },
    note: { type: String, maxlength: 500 },
    occurredAt: { type: Date, required: true, default: Date.now },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

manualEarningSchema.index({ providerProfileId: 1, occurredAt: -1 });
manualEarningSchema.index({ occurredAt: -1 });

export type ManualEarningDocument = InferSchemaType<typeof manualEarningSchema> & {
  _id: Types.ObjectId;
};

export const ManualEarningModel: Model<ManualEarningDocument> =
  registerModel<ManualEarningDocument>("ManualEarning", manualEarningSchema);
