import { ChatThreadTypes, type ChatThreadType } from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * ChatThread — metadata only; messages in separate collection (unbounded).
 * lastMessage preview embedded for inbox performance (single field denorm).
 */
const chatThreadSchema = new Schema(
  {
    type: {
      type: String,
      enum: Object.values(ChatThreadTypes),
      default: ChatThreadTypes.APPOINTMENT,
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      sparse: true,
      unique: true,
    },
    participantIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length >= 2,
        message: "At least two participants required",
      },
    },
    lastMessageAt: { type: Date, index: true },
    lastMessagePreview: { type: String, maxlength: 200 },
    isClosed: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

chatThreadSchema.index({ participantIds: 1, lastMessageAt: -1 });

export type ChatThreadDocument = InferSchemaType<typeof chatThreadSchema> & {
  _id: Schema.Types.ObjectId;
  type: ChatThreadType;
};

export const ChatThreadModel: Model<ChatThreadDocument> =
  registerModel<ChatThreadDocument>("ChatThread", chatThreadSchema);

/**
 * ChatMessage — one doc per message (referenced). Never embed in thread.
 */
const chatMessageSchema = new Schema(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "ChatThread",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: { type: String, maxlength: 5000 },
    attachmentUrl: { type: String },
    attachmentMime: { type: String },
    readBy: [{ userId: Schema.Types.ObjectId, readAt: Date }],
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

chatMessageSchema.index({ threadId: 1, createdAt: -1 });

export type ChatMessageDocument = InferSchemaType<typeof chatMessageSchema> & {
  _id: Schema.Types.ObjectId;
};

export const ChatMessageModel: Model<ChatMessageDocument> =
  registerModel<ChatMessageDocument>("ChatMessage", chatMessageSchema);
