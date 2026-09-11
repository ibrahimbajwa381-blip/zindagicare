import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * DoctorPayout — admin-recorded manual disbursement to a doctor's bank/wallet account.
 * Not a payment gateway record; purely a ledger entry for tracking what's been paid out.
 */
const doctorPayoutSchema = new Schema(
  {
    doctorProfileId: {
      type: Schema.Types.ObjectId,
      ref: "DoctorProfile",
      required: true,
      index: true,
    },
    /** Which provider role this payout belongs to. Defaults to "doctor". */
    providerRole: {
      type: String,
      enum: ["doctor", "herbalist", "nutritionist"],
      default: "doctor",
      index: true,
    },
    /** Provider profile id for non-doctor providers. */
    providerProfileId: { type: Schema.Types.ObjectId, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ["bank_transfer", "jazzcash", "easypaisa", "cash", "other"],
      default: "bank_transfer",
    },
    note: { type: String, maxlength: 500 },
    receipt: {
      storageKey: String,
      url: String,
      originalName: String,
      mimeType: String,
    },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

doctorPayoutSchema.index({ doctorProfileId: 1, paidAt: -1 });
doctorPayoutSchema.index({ providerProfileId: 1, paidAt: -1 });

export type DoctorPayoutDocument = InferSchemaType<typeof doctorPayoutSchema> & {
  _id: Types.ObjectId;
};

export const DoctorPayoutModel: Model<DoctorPayoutDocument> =
  registerModel<DoctorPayoutDocument>("DoctorPayout", doctorPayoutSchema);
