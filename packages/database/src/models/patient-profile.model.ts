import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { registerModel } from "../lib/register-model";

/**
 * PatientProfile — 1:1 with User (patient role).
 * Clinical attributes separated from User for HIPAA-style field isolation & smaller auth docs.
 * Sensitive clinical fields are encrypted at rest.
 */
const patientProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    dateOfBirth: { type: Schema.Types.Mixed },
    gender: { type: String, enum: ["male", "female", "other"] },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", null],
    },
    allergies: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },
    defaultCity: { type: String, default: "Lahore", index: true },
    emergencyContact: {
      name: String,
      phone: String,
      relation: String,
    },
    /**
     * Doctor who referred this patient (via their personal referral link), set once at
     * profile creation and never mutated afterward. Drives a lifetime commission bonus
     * for that doctor on this patient's appointments.
     */
    referredByDoctorId: {
      type: Schema.Types.ObjectId,
      ref: "DoctorProfile",
      default: null,
    },
    /** Referring herbalist (from their /r/[code] invite link). */
    referredByHerbalistId: {
      type: Schema.Types.ObjectId,
      ref: "HerbalistProfile",
      default: null,
    },
    /** Referring nutritionist (from their /r/[code] invite link). */
    referredByNutritionistId: {
      type: Schema.Types.ObjectId,
      ref: "NutritionistProfile",
      default: null,
    },
    referredAt: { type: Date, default: null },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

applyFieldEncryption(patientProfileSchema, {
  fields: [
    { path: "dateOfBirth", kind: "date" },
    { path: "allergies", kind: "strings" },
    { path: "chronicConditions", kind: "strings" },
    { path: "emergencyContact", kind: "object" },
  ],
});

export type PatientProfileDocument = InferSchemaType<
  typeof patientProfileSchema
> & { _id: Types.ObjectId };

export const PatientProfileModel: Model<PatientProfileDocument> =
  registerModel<PatientProfileDocument>(
    "PatientProfile",
    patientProfileSchema,
  );
