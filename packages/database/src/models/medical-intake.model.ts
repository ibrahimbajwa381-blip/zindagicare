import {
  IntakeSources,
  IntakeStatuses,
  type IntakeSource,
  type IntakeStatus,
} from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { registerModel } from "../lib/register-model";

/**
 * MedicalIntake — per-appointment pre-consult medical history.
 * Questions are snapshotted at creation so later doctor edits to their
 * question list never break an in-flight intake.
 * source: "chat" = answered via the chat bot (paid online consults),
 *         "form" = answered via the intake form (Sunday free consults).
 */
const intakeQuestionSchema = new Schema(
  {
    key: { type: String, required: true },
    text: { type: String, required: true, maxlength: 300 },
    answer: { type: String, maxlength: 2000 },
    answeredAt: { type: Date },
  },
  { _id: false },
);

const medicalIntakeSchema = new Schema(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
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
    source: {
      type: String,
      enum: Object.values(IntakeSources),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(IntakeStatuses),
      default: IntakeStatuses.PENDING,
      index: true,
    },
    currentQuestionIndex: { type: Number, default: 0, min: 0 },
    questions: { type: [intakeQuestionSchema], default: [] },
    /** Patient UI language when the intake was created (en | ur). */
    locale: { type: String, enum: ["en", "ur"], default: "en" },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

applyFieldEncryption(medicalIntakeSchema, {
  fields: [
    {
      path: "questions",
      kind: "nestedArray",
      subFields: ["text", "answer"],
    },
  ],
});

medicalIntakeSchema.index({ doctorId: 1, status: 1 });

export type MedicalIntakeDocument = InferSchemaType<
  typeof medicalIntakeSchema
> & {
  _id: Schema.Types.ObjectId;
  source: IntakeSource;
  status: IntakeStatus;
};

export const MedicalIntakeModel: Model<MedicalIntakeDocument> =
  registerModel<MedicalIntakeDocument>("MedicalIntake", medicalIntakeSchema);
