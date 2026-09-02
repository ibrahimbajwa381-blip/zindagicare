import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * ActivityEvent — lightweight product-analytics trail (feature usage, friction
 * signals) distinct from AuditLog, which is the compliance/change trail.
 * High write volume, short retention — capped by TTL, not meant for legal record-keeping.
 */
const activityEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    userRole: { type: String, index: true },
    /** Anonymous-visitor cookie id — lets pre-signup visits be correlated with a later signup. */
    visitorId: { type: String, index: true },
    action: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["success", "error"],
      default: "success",
      index: true,
    },
    entityType: { type: String, index: true },
    entityId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed },
    platform: { type: String },
    path: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activityEventSchema.index({ userId: 1, createdAt: -1 });
activityEventSchema.index({ action: 1, createdAt: -1 });
activityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export type ActivityEventDocument = InferSchemaType<typeof activityEventSchema> & {
  _id: Schema.Types.ObjectId;
};

export const ActivityEventModel: Model<ActivityEventDocument> =
  registerModel<ActivityEventDocument>("ActivityEvent", activityEventSchema);
