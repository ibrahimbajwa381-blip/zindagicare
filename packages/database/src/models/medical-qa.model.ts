import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * Public medical Q&A.
 *
 * Separate from ChatThread/ChatMessage on purpose: chat threads are private,
 * participant-locked and encrypted, while a public question is readable by
 * anyone and answerable by any verified provider. Each MedicalQuestion is
 * its own thread — its _id is the thread id every MedicalAnswer points to.
 * Answers and follow-ups are one document each (unbounded; never embedded).
 */

const idempotencyIndex = {
  unique: true,
  partialFilterExpression: { idempotencyKey: { $type: "string" } },
} as const;

const medicalQuestionSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, required: true },
    title: { type: String, required: true, maxlength: 150 },
    body: { type: String, required: true, maxlength: 3000 },
    moderationStatus: { type: String, enum: ["visible", "hidden"], default: "visible" },
    /** Provider answers only (follow-ups from the author are not counted). */
    answerCount: { type: Number, default: 0, min: 0 },
    /** Reserved + stored attachment slots; incremented atomically before upload. */
    attachmentCount: { type: Number, default: 0, min: 0 },
    lastActivityAt: { type: Date, default: () => new Date() },
    idempotencyKey: { type: String },
    deletedAt: { type: Date },
    /**
     * New-question alert fan-out to professionals (see medical-qa-alerts.service).
     * `processing` is held under a short lease so only one worker runs at a time;
     * `failed` is retried by the sweep until `alertAttempts` reaches its limit.
     */
    alertStatus: { type: String, enum: ["pending", "processing", "done", "failed"], default: "pending" },
    alertAttempts: { type: Number, default: 0, min: 0 },
    alertLeaseUntil: { type: Date },
    alertNextAttemptAt: { type: Date },
    alertedAt: { type: Date },
    alertRecipientCount: { type: Number, min: 0 },
    /** Last "your question has an answer" push to the author (see medical-qa-answer-notify.service). */
    answerPushAt: { type: Date },
  },
  { timestamps: true },
);

medicalQuestionSchema.index({ alertStatus: 1, alertNextAttemptAt: 1 });
medicalQuestionSchema.index({ moderationStatus: 1, deletedAt: 1, _id: -1 });
medicalQuestionSchema.index({ category: 1, moderationStatus: 1, _id: -1 });
medicalQuestionSchema.index({ answerCount: 1, moderationStatus: 1, _id: -1 });
medicalQuestionSchema.index({ authorId: 1, idempotencyKey: 1 }, idempotencyIndex);

export type MedicalQuestionDocument = InferSchemaType<typeof medicalQuestionSchema> & {
  _id: Types.ObjectId;
};

export const MedicalQuestionModel: Model<MedicalQuestionDocument> =
  registerModel<MedicalQuestionDocument>("MedicalQuestion", medicalQuestionSchema);

const medicalAnswerSchema = new Schema(
  {
    /** The question (thread) this message belongs to. */
    questionId: { type: Schema.Types.ObjectId, ref: "MedicalQuestion", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Role the author answered as, resolved server-side from verified profiles. */
    authorRole: {
      type: String,
      enum: ["doctor", "nurse", "physiotherapist", "patient"],
      required: true,
    },
    kind: { type: String, enum: ["answer", "follow_up"], required: true },
    body: { type: String, required: true, maxlength: 3000 },
    moderationStatus: { type: String, enum: ["visible", "hidden"], default: "visible" },
    idempotencyKey: { type: String },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

medicalAnswerSchema.index({ questionId: 1, createdAt: 1 });
medicalAnswerSchema.index({ authorId: 1, idempotencyKey: 1 }, idempotencyIndex);

export type MedicalAnswerDocument = InferSchemaType<typeof medicalAnswerSchema> & {
  _id: Types.ObjectId;
};

export const MedicalAnswerModel: Model<MedicalAnswerDocument> =
  registerModel<MedicalAnswerDocument>("MedicalAnswer", medicalAnswerSchema);

/**
 * Metadata for an encrypted, re-encoded image in object storage. The binary
 * never lives in MongoDB, and attachments are private regardless of the
 * question being public.
 */
const medicalQuestionAttachmentSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "MedicalQuestion", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Server-generated `<questionId>/<uuid>.webp`; never client-supplied. */
    storageKey: { type: String, required: true, unique: true },
    contentType: { type: String, enum: ["image/webp"], required: true },
    bytes: { type: Number, required: true, min: 1 },
    originalBytes: { type: Number, required: true, min: 1 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    visibility: { type: String, enum: ["private"], default: "private" },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

export type MedicalQuestionAttachmentDocument = InferSchemaType<typeof medicalQuestionAttachmentSchema> & {
  _id: Types.ObjectId;
};

export const MedicalQuestionAttachmentModel: Model<MedicalQuestionAttachmentDocument> =
  registerModel<MedicalQuestionAttachmentDocument>("MedicalQuestionAttachment", medicalQuestionAttachmentSchema);

const medicalQaReportSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "MedicalQuestion", required: true },
    targetType: { type: String, enum: ["question", "answer"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true },
    details: { type: String, maxlength: 500 },
    status: { type: String, enum: ["open", "actioned", "dismissed"], default: "open" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

medicalQaReportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });
medicalQaReportSchema.index({ status: 1, createdAt: -1 });
medicalQaReportSchema.index({ targetId: 1 });

export type MedicalQaReportDocument = InferSchemaType<typeof medicalQaReportSchema> & {
  _id: Types.ObjectId;
};

export const MedicalQaReportModel: Model<MedicalQaReportDocument> =
  registerModel<MedicalQaReportDocument>("MedicalQaReport", medicalQaReportSchema);

/**
 * One row per (question, professional) alert. The unique index is what makes
 * fan-out idempotent: retries and concurrent workers can never create a second
 * in-app notification or push for the same pair. Stores ids and delivery state
 * only — never question text.
 */
const medicalQaAlertSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "MedicalQuestion", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipientRole: { type: String, enum: ["doctor", "nurse", "physiotherapist"], required: true },
    /** The in-app Notification created for this alert (set once). */
    notificationId: { type: Schema.Types.ObjectId, ref: "Notification" },
    pushStatus: {
      type: String,
      enum: ["pending", "sent", "no_device", "throttled", "quiet_hours", "failed", "skipped"],
      default: "pending",
    },
    pushAttempts: { type: Number, default: 0, min: 0 },
    /** Short machine-readable reason only (e.g. "timeout"); never provider payloads. */
    lastError: { type: String, maxlength: 64 },
  },
  { timestamps: true },
);

medicalQaAlertSchema.index({ questionId: 1, recipientId: 1 }, { unique: true });
medicalQaAlertSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export type MedicalQaAlertDocument = InferSchemaType<typeof medicalQaAlertSchema> & {
  _id: Types.ObjectId;
};

export const MedicalQaAlertModel: Model<MedicalQaAlertDocument> =
  registerModel<MedicalQaAlertDocument>("MedicalQaAlert", medicalQaAlertSchema);

/**
 * Per-user new-question alert state. No row means alerts are on.
 * `lastPushAt` is the shared push throttle: claimed atomically before a push
 * and released if the push fails, so a failure never uses up the window.
 */
const medicalQaAlertPreferenceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    questionAlerts: { type: Boolean, required: true, default: true },
    lastPushAt: { type: Date },
  },
  { timestamps: true },
);

export type MedicalQaAlertPreferenceDocument = InferSchemaType<typeof medicalQaAlertPreferenceSchema> & {
  _id: Types.ObjectId;
};

export const MedicalQaAlertPreferenceModel: Model<MedicalQaAlertPreferenceDocument> =
  registerModel<MedicalQaAlertPreferenceDocument>("MedicalQaAlertPreference", medicalQaAlertPreferenceSchema);
