import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * Short-lived phone OTP challenges.
 * Shared across API routes and server actions (unlike in-process memory).
 */
const otpChallengeSchema = new Schema(
  {
    phoneKey: { type: String, required: true, unique: true },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpChallengeDocument = InferSchemaType<typeof otpChallengeSchema> & {
  _id: Schema.Types.ObjectId;
};

export const OtpChallengeModel: Model<OtpChallengeDocument> =
  registerModel<OtpChallengeDocument>("OtpChallenge", otpChallengeSchema);
