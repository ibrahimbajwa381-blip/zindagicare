import { Schema, type InferSchemaType, type Model } from "mongoose";
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
> & { _id: Schema.Types.ObjectId };

export const PatientProfileModel: Model<PatientProfileDocument> =
  registerModel<PatientProfileDocument>(
    "PatientProfile",
    patientProfileSchema,
  );
