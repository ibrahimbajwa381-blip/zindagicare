import { Roles } from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { geoPointSchema } from "../schemas/geo.schema";
import { registerModel } from "../lib/register-model";

/**
 * StaffProfile — nurse / rider operational profile (1:1 User).
 */
const staffProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    staffType: {
      type: String,
      enum: [Roles.NURSE, Roles.RIDER],
      required: true,
    },
    employeeCode: { type: String, unique: true, sparse: true },
    serviceAreas: [
      {
        city: String,
        area: String,
        geo: geoPointSchema,
        radiusKm: { type: Number, default: 15 },
      },
    ],
    homeVisitEnabled: { type: Boolean, default: false, index: true },
    isAvailable: { type: Boolean, default: true, index: true },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    // Credential verification (nurse onboarding — reviewed by admin)
    licenseNumber: { type: String },
    cnicHash: { type: String },
    cnicLast4: { type: String },
    qualification: { type: String },
    experienceYears: { type: Number },
    verificationDocuments: {
      licenseCertificate: { type: String },
      cnicFront: { type: String },
      cnicBack: { type: String },
    },
    verificationSubmittedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    rejectionReason: { type: String },
    /** Private admin-only notes (e.g. interview observations). */
    adminNotes: { type: String, maxlength: 5000 },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

applyFieldEncryption(staffProfileSchema, {
  fields: [
    { path: "licenseNumber", kind: "string" },
    { path: "qualification", kind: "string" },
    { path: "rejectionReason", kind: "string" },
    { path: "adminNotes", kind: "string" },
  ],
});

staffProfileSchema.index({ staffType: 1, isAvailable: 1 });

export type StaffProfileDocument = InferSchemaType<
  typeof staffProfileSchema
> & { _id: Schema.Types.ObjectId };

export const StaffProfileModel: Model<StaffProfileDocument> =
  registerModel<StaffProfileDocument>("StaffProfile", staffProfileSchema);
