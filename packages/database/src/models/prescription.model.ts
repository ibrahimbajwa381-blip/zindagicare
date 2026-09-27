import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { registerModel } from "../lib/register-model";

/**
 * Prescription — file metadata only (binary in Supabase).
 * Medicines list embedded only when structured (small); OCR results reference separate AI job.
 */
const prescriptionSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    doctorId: { type: Schema.Types.ObjectId, ref: "DoctorProfile" },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    fileUrl: { type: String, required: true },
    fileKey: { type: String, required: true },
    mimeType: { type: String },
    fileSizeBytes: { type: Number },
    issuedAt: { type: Date },
    /** Optional structured meds — bounded array, not full pharmacy catalog */
    medications: [
      {
        name: String,
        dosage: String,
        frequency: String,
        duration: String,
      },
    ],
    notes: { type: String, maxlength: 2000 },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

applyFieldEncryption(prescriptionSchema, {
  fields: [
    {
      path: "medications",
      kind: "nestedArray",
      subFields: ["name", "dosage", "frequency", "duration"],
    },
    { path: "notes", kind: "string" },
  ],
});

prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ appointmentId: 1 }, { sparse: true });

export type PrescriptionDocument = InferSchemaType<
  typeof prescriptionSchema
> & { _id: Types.ObjectId };

export const PrescriptionModel: Model<PrescriptionDocument> =
  registerModel<PrescriptionDocument>("Prescription", prescriptionSchema);
