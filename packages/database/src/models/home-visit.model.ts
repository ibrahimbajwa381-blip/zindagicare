import {
  CancellationRequestStatuses,
  HomeVisitServiceTypes,
  HomeVisitStatuses,
  RefundMethods,
  type HomeVisitServiceType,
  type HomeVisitStatus,
} from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { geoPointSchema } from "../schemas/geo.schema";
import { registerModel } from "../lib/register-model";

/**
 * HomeVisit — geo-indexed service requests with staff assignment.
 */
const homeVisitSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    serviceType: {
      type: String,
      enum: Object.values(HomeVisitServiceTypes),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(HomeVisitStatuses),
      default: HomeVisitStatuses.REQUESTED,
      index: true,
    },
    assignedStaffId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    scheduledAt: { type: Date, required: true, index: true },
    address: {
      line: { type: String, required: true },
      city: { type: String, required: true, default: "Lahore" },
      geo: { type: geoPointSchema, required: true },
    },
    pricing: {
      base: { type: Number, default: 0 },
      surge: { type: Number, default: 0 },
      distance: { type: Number, default: 0 },
      total: { type: Number, required: true },
      currency: { type: String, default: "PKR" },
    },
    patientNotes: { type: String, maxlength: 1000 },
    staffNotes: { type: String, maxlength: 2000, select: false },
    liveLocation: {
      geo: geoPointSchema,
      updatedAt: Date,
    },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    /** Patient requested to cancel a paid visit + be refunded; admin reviews and resolves this. */
    cancellationRequestStatus: {
      type: String,
      enum: Object.values(CancellationRequestStatuses),
      default: CancellationRequestStatuses.NONE,
    },
    cancellationRequestedAt: { type: Date },
    cancellationRequestResolvedAt: { type: Date },
    cancellationRequestResolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    /** Where the admin should manually send the refund if this request is approved. */
    refundMethod: { type: String, enum: Object.values(RefundMethods) },
    refundAccountTitle: { type: String, maxlength: 100 },
    refundAccountNumber: { type: String, maxlength: 50 },
    refundBankName: { type: String, maxlength: 100 },
    visitReport: {
      storageKey: String,
      url: String,
      originalName: String,
      mimeType: String,
      uploadedAt: Date,
      uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

applyFieldEncryption(homeVisitSchema, {
  fields: [
    { path: "address.line", kind: "string" },
    { path: "patientNotes", kind: "string" },
    { path: "staffNotes", kind: "string" },
    { path: "cancellationReason", kind: "string" },
    { path: "refundAccountTitle", kind: "string" },
    { path: "refundAccountNumber", kind: "string" },
    { path: "refundBankName", kind: "string" },
    { path: "visitReport.originalName", kind: "string" },
  ],
});

homeVisitSchema.index({ "address.geo": "2dsphere" });
homeVisitSchema.index({ status: 1, scheduledAt: 1 });
homeVisitSchema.index({ assignedStaffId: 1, status: 1, scheduledAt: 1 });
homeVisitSchema.index({ patientId: 1, createdAt: -1 });

export type HomeVisitDocument = InferSchemaType<typeof homeVisitSchema> & {
  _id: Schema.Types.ObjectId;
  serviceType: HomeVisitServiceType;
  status: HomeVisitStatus;
};

export const HomeVisitModel: Model<HomeVisitDocument> =
  registerModel<HomeVisitDocument>("HomeVisit", homeVisitSchema);
