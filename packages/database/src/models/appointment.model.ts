import {
  AppointmentStatuses,
  AppointmentTypes,
  type AppointmentStatus,
  type AppointmentType,
} from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * Appointment — core scheduling entity (referenced links to payments, visits, video).
 * High write volume; indexes aligned to patient/doctor dashboards + Sunday rules.
 */
const appointmentSchema = new Schema(
  {
    type: {
      type: String,
      enum: Object.values(AppointmentTypes),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(AppointmentStatuses),
      default: AppointmentStatuses.PENDING,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "DoctorProfile",
      required: true,
      index: true,
    },
    /** Booked for family member without own account */
    familyMemberId: { type: Schema.Types.ObjectId, ref: "FamilyMember" },
    scheduledStart: { type: Date, required: true, index: true },
    scheduledEnd: { type: Date, required: true },
    timezone: { type: String, default: "Asia/Karachi" },
    /** Sunday free consult linkage */
    sundaySlotInstanceId: {
      type: Schema.Types.ObjectId,
      ref: "SundaySlotInstance",
    },
    sundaySlotId: { type: String },
    /** YYYY-MM-DD (Asia/Karachi Sunday) — one free consult per patient per week */
    sundayDateKey: { type: String, index: true },
    clinic: {
      hospitalName: String,
      address: String,
      city: String,
    },
    isOnline: { type: Boolean, default: false },
    homeVisitId: { type: Schema.Types.ObjectId, ref: "HomeVisit" },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    videoSessionId: { type: Schema.Types.ObjectId, ref: "VideoSession" },
    chatThreadId: { type: Schema.Types.ObjectId, ref: "ChatThread" },
    cancellationReason: { type: String },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    patientNotes: { type: String, maxlength: 1000 },
    doctorNotes: { type: String, maxlength: 5000, select: false },
    noShowMarkedAt: { type: Date },
    /** Who failed to attend when status is no_show: "patient" or "doctor". */
    missedBy: { type: String, enum: ["patient", "doctor"] },
    /** Set by the accountability sweep when a doctor never joined an accepted consult. */
    doctorMissedAt: { type: Date },
    remindersSent: {
      h24: { type: Boolean, default: false },
      h1: { type: Boolean, default: false },
      sundayMorning: { type: Boolean, default: false },
      doctorH24: { type: Boolean, default: false },
      doctorH1: { type: Boolean, default: false },
      doctorSundayMorning: { type: Boolean, default: false },
    },
    completedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

appointmentSchema.index({ patientId: 1, scheduledStart: -1, status: 1 });
appointmentSchema.index({ doctorId: 1, scheduledStart: -1, status: 1 });
appointmentSchema.index({ type: 1, status: 1, scheduledStart: 1 });
appointmentSchema.index(
  {
    patientId: 1,
    type: 1,
    sundayDateKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      type: AppointmentTypes.SUNDAY_FREE,
      sundayDateKey: { $type: "string" },
      status: {
        $in: [
          AppointmentStatuses.PENDING,
          AppointmentStatuses.CONFIRMED,
          AppointmentStatuses.IN_PROGRESS,
        ],
      },
      deletedAt: null,
    },
  },
);

export type AppointmentDocument = InferSchemaType<typeof appointmentSchema> & {
  _id: Schema.Types.ObjectId;
  type: AppointmentType;
  status: AppointmentStatus;
};

export const AppointmentModel: Model<AppointmentDocument> =
  registerModel<AppointmentDocument>("Appointment", appointmentSchema);
