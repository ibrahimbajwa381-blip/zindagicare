import { NotificationChannels, type NotificationChannel } from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { registerModel } from "../lib/register-model";

/**
 * Notification — append-only inbox per user.
 * Title/body denormalized for list API; payload for deep links (not full PHI).
 */
const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: Object.values(NotificationChannels),
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 1000 },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    readAt: { type: Date, index: true },
    sentAt: { type: Date, default: Date.now },
    externalId: { type: String },
    failedAt: { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true },
);

applyFieldEncryption(notificationSchema, {
  fields: [
    { path: "title", kind: "string" },
    { path: "body", kind: "string" },
  ],
});

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export type NotificationDocument = InferSchemaType<
  typeof notificationSchema
> & {
  _id: Schema.Types.ObjectId;
  channel: NotificationChannel;
};

export const NotificationModel: Model<NotificationDocument> =
  registerModel<NotificationDocument>("Notification", notificationSchema);
