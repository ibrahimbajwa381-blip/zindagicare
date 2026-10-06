import { Roles } from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { geoPointSchema } from "../schemas/geo.schema";
import { registerModel } from "../lib/register-model";

const yearField = { type: Number, min: 1900, max: 2100 };

/**
 * Physiotherapist / nurse public portfolio — everything beyond the verification basics that
 * builds out /physiotherapists/[slug] and /nurses/[slug]. `bio` and `languages` stay
 * top-level (older field).
 */
const portfolioSchema = new Schema(
  {
    headline: { type: String, maxlength: 120 },
    conditionsTreated: { type: [String], default: undefined },
    techniques: { type: [String], default: undefined },
    memberships: { type: [String], default: undefined },
    education: {
      type: [
        new Schema(
          { degree: String, institute: String, year: yearField },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    experience: {
      type: [
        new Schema(
          {
            role: String,
            organization: String,
            city: String,
            startYear: yearField,
            endYear: yearField,
            current: { type: Boolean, default: false },
            description: { type: String, maxlength: 500 },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    certifications: {
      type: [
        new Schema(
          { title: String, issuer: String, year: yearField, url: { type: String, maxlength: 500 } },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    awards: {
      type: [new Schema({ title: String, year: yearField }, { _id: false })],
      default: undefined,
    },
    updatedAt: { type: Date },
  },
  { _id: false },
);

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
      enum: [Roles.NURSE, Roles.RIDER, Roles.PHYSIOTHERAPIST],
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
    /** Physiotherapist's own per-visit fee (PKR); unset means the platform rate. */
    homeVisitFee: { type: Number, min: 0 },
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
    /** Nursing / physiotherapy sub-specialties. */
    specialties: [{ type: String }],
    /** Public profile — shown on /physiotherapists/[slug] or /nurses/[slug]. */
    slug: { type: String, unique: true, sparse: true, lowercase: true },
    bio: { type: String, maxlength: 2000 },
    languages: { type: [String], default: undefined },
    portfolio: { type: portfolioSchema, default: undefined },
    verificationDocuments: {
      /** Degree certificate (physiotherapist only — required at onboarding). */
      degreeCertificate: { type: String },
      licenseCertificate: { type: String },
      cnicFront: { type: String },
      cnicBack: { type: String },
    },
    verificationSubmittedAt: { type: Date },
    /** Anti-circumvention / off-platform payment policy acceptance, captured at verification submit. */
    platformAgreementAcceptedAt: { type: Date },
    platformAgreementVersion: { type: String },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    rejectionReason: { type: String },
    /** Nurse revenue share override (0–100). Null uses platform default. */
    commissionPercent: { type: Number, min: 0, max: 100, default: null },
    /** Private admin-only notes (e.g. interview observations). */
    adminNotes: { type: String, maxlength: 5000 },
    /** Payout destination for admin-initiated Sunday payouts (physiotherapist). */
    bankAccount: {
      accountTitle: String,
      accountNumber: String,
      bankName: String,
      iban: String,
    },
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
    { path: "bankAccount", kind: "object" },
  ],
});

staffProfileSchema.index({ staffType: 1, isAvailable: 1 });

export type StaffProfileDocument = InferSchemaType<
  typeof staffProfileSchema
> & { _id: Types.ObjectId };

export const StaffProfileModel: Model<StaffProfileDocument> =
  registerModel<StaffProfileDocument>("StaffProfile", staffProfileSchema);
