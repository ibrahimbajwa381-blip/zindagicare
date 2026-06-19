import {
  UrgentCareRequestStatuses,
  type UrgentCareRequestStatus,
} from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { registerModel } from "../lib/register-model";

const urgentCareRequestSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /** Callback number for the on-call doctor (MVP: phone call outside the app) */
    patientPhone: { type: String, required: true, trim: true },
    patientNotes: { type: String, maxlength: 1000 },
    status: {
      type: String,
      enum: Object.values(UrgentCareRequestStatuses),
      default: UrgentCareRequestStatuses.REQUESTED,
      index: true,
    },
    assignedDoctorId: { type: Schema.Types.ObjectId, ref: "DoctorProfile", index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAt: { type: Date },
    adminNotes: { type: String, maxlength: 2000, select: false },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, maxlength: 500 },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

urgentCareRequestSchema.index({ status: 1, createdAt: -1 });
urgentCareRequestSchema.index({ patientId: 1, status: 1, createdAt: -1 });

applyFieldEncryption(urgentCareRequestSchema, {
  fields: [
    { path: "patientPhone", kind: "string" },
    { path: "patientNotes", kind: "string" },
    { path: "adminNotes", kind: "string" },
    { path: "cancellationReason", kind: "string" },
  ],
});

export type UrgentCareRequestDocument = InferSchemaType<typeof urgentCareRequestSchema> & {
  _id: Schema.Types.ObjectId;
  status: UrgentCareRequestStatus;
};

export const UrgentCareRequestModel: Model<UrgentCareRequestDocument> =
  registerModel<UrgentCareRequestDocument>("UrgentCareRequest", urgentCareRequestSchema);
