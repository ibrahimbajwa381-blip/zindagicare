import { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { registerModel } from "../lib/register-model";

export const CopilotSessionStatuses = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type CopilotSessionStatus =
  (typeof CopilotSessionStatuses)[keyof typeof CopilotSessionStatuses];

export const CopilotMessageRoles = {
  USER: "user",
  ASSISTANT: "assistant",
  TOOL: "tool",
} as const;

export type CopilotMessageRole =
  (typeof CopilotMessageRoles)[keyof typeof CopilotMessageRoles];

export const CopilotTriageLevels = {
  SELF_CARE: "self_care",
  BOOK_CONSULT: "book_consult",
  URGENT: "urgent",
  EMERGENCY: "emergency",
} as const;

export type CopilotTriageLevel =
  (typeof CopilotTriageLevels)[keyof typeof CopilotTriageLevels];

const copilotSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    locale: { type: String, enum: ["en", "ur"], default: "en" },
    title: { type: String, maxlength: 120 },
    xaiPreviousResponseId: { type: String },
    status: {
      type: String,
      enum: Object.values(CopilotSessionStatuses),
      default: CopilotSessionStatuses.ACTIVE,
      index: true,
    },
    lastMessageAt: { type: Date, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

copilotSessionSchema.index({ userId: 1, status: 1, lastMessageAt: -1 });

export type CopilotSessionDocument = InferSchemaType<typeof copilotSessionSchema> & {
  _id: Schema.Types.ObjectId;
  status: CopilotSessionStatus;
};

export const CopilotSessionModel: Model<CopilotSessionDocument> =
  registerModel<CopilotSessionDocument>("CopilotSession", copilotSessionSchema);

const copilotMessageSchema = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "CopilotSession",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(CopilotMessageRoles),
      required: true,
    },
    content: { type: String, maxlength: 16000 },
    metadata: { type: Schema.Types.Mixed },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

applyFieldEncryption(copilotMessageSchema, {
  fields: [{ path: "content", kind: "string" }],
});

copilotMessageSchema.index({ sessionId: 1, createdAt: 1 });

export type CopilotMessageDocument = InferSchemaType<typeof copilotMessageSchema> & {
  _id: Schema.Types.ObjectId;
  role: CopilotMessageRole;
};

export const CopilotMessageModel: Model<CopilotMessageDocument> =
  registerModel<CopilotMessageDocument>("CopilotMessage", copilotMessageSchema);
