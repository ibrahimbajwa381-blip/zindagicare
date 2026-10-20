import {
  SundayAffordabilityChoices,
  SundayFreeRequestStatuses,
  type SundayAffordabilityChoice,
  type SundayFreeRequestStatus,
} from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { registerModel } from "../lib/register-model";

const historyAnswerSchema = new Schema(
  {
    key: { type: String, required: true },
    text: { type: String, required: true, maxlength: 300 },
    answer: { type: String, required: true, maxlength: 2000 },
  },
  { _id: false },
);

/**
 * Sunday free consult request — patient asks for a free video consult;
 * any verified doctor picks it and chooses a time (no patient-side doctor picker).
 * Optional Rs contribution (`pay_fee`) uses the same JazzCash transfer flow as paid booking.
 */
const sundayFreeRequestSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    patientPhone: { type: String, required: true, trim: true },
    /** Legacy free-text notes (requests made before history was required). */
    patientNotes: { type: String, maxlength: 1000 },
    /** Medical history — same questions as the paid online consult intake. */
    history: { type: [historyAnswerSchema], default: [] },
    historyLocale: { type: String, enum: ["en", "ur"], default: "en" },
    /**
     * Optional specialty the patient wants (e.g. "Gynecologist"). When set, only
     * doctors with this admin-verified specialty see and can pick the request.
     */
    preferredSpecialty: { type: String, trim: true, index: true },
    affordabilityChoice: {
      type: String,
      enum: Object.values(SundayAffordabilityChoices),
      default: SundayAffordabilityChoices.CANNOT_AFFORD,
      index: true,
    },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", index: true },
    /** YYYY-MM-DD (Asia/Karachi Sunday) — one free request per patient per week */
    sundayDateKey: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(SundayFreeRequestStatuses),
      default: SundayFreeRequestStatuses.REQUESTED,
      index: true,
    },
    assignedDoctorId: { type: Schema.Types.ObjectId, ref: "DoctorProfile", index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAt: { type: Date },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", index: true },
    adminNotes: { type: String, maxlength: 2000, select: false },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, maxlength: 500 },
    /** Admin who rejected the request (unset when the patient/doctor flow cancelled it). */
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

sundayFreeRequestSchema.index({ status: 1, createdAt: -1 });
sundayFreeRequestSchema.index({ patientId: 1, status: 1, createdAt: -1 });
sundayFreeRequestSchema.index(
  { patientId: 1, sundayDateKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sundayDateKey: { $type: "string" },
      status: {
        $in: [
          SundayFreeRequestStatuses.REQUESTED,
          SundayFreeRequestStatuses.ASSIGNED,
        ],
      },
      deletedAt: null,
    },
  },
);

applyFieldEncryption(sundayFreeRequestSchema, {
  fields: [
    { path: "patientPhone", kind: "string" },
    { path: "patientNotes", kind: "string" },
    { path: "adminNotes", kind: "string" },
    { path: "cancellationReason", kind: "string" },
    { path: "history", kind: "nestedArray", subFields: ["text", "answer"] },
  ],
});

export type SundayFreeRequestDocument = InferSchemaType<typeof sundayFreeRequestSchema> & {
  _id: Types.ObjectId;
  status: SundayFreeRequestStatus;
  affordabilityChoice: SundayAffordabilityChoice;
};

export const SundayFreeRequestModel: Model<SundayFreeRequestDocument> =
  registerModel<SundayFreeRequestDocument>("SundayFreeRequest", sundayFreeRequestSchema);
