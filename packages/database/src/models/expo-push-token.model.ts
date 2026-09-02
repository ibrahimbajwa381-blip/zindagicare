import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

const expoPushTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: { type: String, required: true, unique: true },
    deviceId: { type: String },
    platform: { type: String, enum: ["ios", "android"] },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

expoPushTokenSchema.index({ userId: 1, updatedAt: -1 });

export type ExpoPushTokenDocument = InferSchemaType<typeof expoPushTokenSchema> & {
  _id: Schema.Types.ObjectId;
};

export const ExpoPushTokenModel: Model<ExpoPushTokenDocument> = registerModel<ExpoPushTokenDocument>(
  "ExpoPushToken",
  expoPushTokenSchema,
);
