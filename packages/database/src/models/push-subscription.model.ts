import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

const pushSubscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

pushSubscriptionSchema.index({ userId: 1, updatedAt: -1 });

export type PushSubscriptionDocument = InferSchemaType<
  typeof pushSubscriptionSchema
> & {
  _id: Schema.Types.ObjectId;
};

export const PushSubscriptionModel: Model<PushSubscriptionDocument> =
  registerModel<PushSubscriptionDocument>("PushSubscription", pushSubscriptionSchema);
