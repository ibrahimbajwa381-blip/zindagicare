import {
  AppointmentTypes,
  type AppointmentType,
} from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * DoctorMiss — append-only strike log. One document per consult a doctor failed to attend.
 * Unique `appointmentId` guarantees a single appointment is never counted twice, even if the
 * sweep job runs concurrently. Monthly counts are derived by querying on `monthKey`.
 */
const doctorMissSchema = new Schema(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "DoctorProfile",
      required: true,
      index: true,
    },
    doctorUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: "User" },
    appointmentType: {
      type: String,
      enum: Object.values(AppointmentTypes),
      required: true,
    },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    missedAt: { type: Date, required: true, default: Date.now },
    /** YYYY-MM in Asia/Karachi — the bucket used for monthly thresholds. */
    monthKey: { type: String, required: true, index: true },
    reason: { type: String, default: "doctor_no_join" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

doctorMissSchema.index({ doctorId: 1, monthKey: 1, missedAt: -1 });

export type DoctorMissDocument = InferSchemaType<typeof doctorMissSchema> & {
  _id: Schema.Types.ObjectId;
  appointmentType: AppointmentType;
};

export const DoctorMissModel: Model<DoctorMissDocument> =
  registerModel<DoctorMissDocument>("DoctorMiss", doctorMissSchema);
