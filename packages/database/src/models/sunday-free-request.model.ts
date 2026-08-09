import {
  SundayFreeRequestStatuses,
  type SundayFreeRequestStatus,
} from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { registerModel } from "../lib/register-model";

/**
 * Sunday free consult request — patient asks for a free video consult;
 * ops assigns an available doctor within the SLA window (no patient-side doctor picker).
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
    patientNotes: { type: String, maxlength: 1000 },
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
  ],
});

export type SundayFreeRequestDocument = InferSchemaType<typeof sundayFreeRequestSchema> & {
  _id: Schema.Types.ObjectId;
  status: SundayFreeRequestStatus;
};

export const SundayFreeRequestModel: Model<SundayFreeRequestDocument> =
  registerModel<SundayFreeRequestDocument>("SundayFreeRequest", sundayFreeRequestSchema);
