import { VerificationStatuses, type VerificationStatus } from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { geoPointSchema } from "../schemas/geo.schema";
import { registerModel } from "../lib/register-model";

/**
 * NutritionistProfile — 1:1 with User when role includes nutritionist.
 * Mirrors DoctorProfile but is video-consult only: no home visits, no urgent
 * on-call matching, no Sunday free-consult slots.
 */
const nutritionistProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    /** Dietetics / nutrition council registration number (e.g. PNDS, RD). */
    licenseNumber: { type: String, trim: true },
    licenseVerified: { type: Boolean, default: false },
    cnicHash: { type: String, select: false },
    cnicLast4: { type: String },
    /** Primary qualification, e.g. BS Nutrition, MSc Human Nutrition, RD. */
    degree: { type: String, trim: true },
    /** Postgraduate / additional qualifications. */
    qualifications: { type: [String], default: [] },
    /** Awarding institute or college. */
    institute: { type: String, trim: true },
    graduationYear: { type: Number, min: 1950 },
    verificationDocuments: {
      licenseCertificate: String,
      cnicFront: String,
      cnicBack: String,
      degreeCertificate: String,
    },
    verificationSubmittedAt: { type: Date },
    /** Anti-circumvention / off-platform payment policy acceptance. */
    platformAgreementAcceptedAt: { type: Date },
    platformAgreementVersion: { type: String },
    /** Nutritionist-chosen primary specialty (required after verification submit). */
    primarySpecialty: { type: String, trim: true },
    /** Nutritionist-requested additional specialties (may include unverified ones). */
    additionalSpecialties: { type: [String], default: [] },
    /** Admin-verified specialties visible to patients. */
    specialties: { type: [String], default: [], index: true },
    experienceYears: { type: Number, default: 0, min: 0 },
    bio: { type: String, maxlength: 2000 },
    languages: { type: [String], default: ["English", "Urdu"] },
    /** Practice locations / clinics (display + city coverage only — no home visits). */
    clinics: [
      {
        name: { type: String, required: true },
        city: { type: String, required: true, index: true },
        address: String,
        geo: geoPointSchema,
      },
    ],
    consultationFee: { type: Number, default: 0, min: 0 },
    videoConsultEnabled: { type: Boolean, default: false },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    /** Weekly consult hours (day 0 = Sunday … 6 = Saturday, times in Asia/Karachi). */
    weeklyAvailability: [
      {
        dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
        startTimeLocal: { type: String, required: true },
        endTimeLocal: { type: String, required: true },
      },
    ],
    /** Pre-consult intake questions; empty/absent means use the platform defaults. */
    intakeQuestions: [
      {
        _id: false,
        id: { type: String, required: true },
        text: { type: String, required: true, maxlength: 300 },
        order: { type: Number, required: true, min: 0 },
        isActive: { type: Boolean, default: true },
      },
    ],
    coverageCities: { type: [String], default: ["Lahore"] },
    /** Override for online consult revenue share (0–100). Null uses platform default. */
    onlineCommissionPercent: { type: Number, min: 0, max: 100, default: null },
    verificationStatus: {
      type: String,
      enum: Object.values(VerificationStatuses),
      default: VerificationStatuses.PENDING,
      index: true,
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    rejectionReason: { type: String },
    slug: { type: String, unique: true, sparse: true, lowercase: true },
    /** Private referral token for the nutritionist's patient-invite link (/r/[code]). */
    referralCode: { type: String, unique: true, sparse: true, index: true },
    isListed: { type: Boolean, default: false },
    /** Payout destination for admin-initiated manual payouts. */
    bankAccount: {
      accountTitle: String,
      accountNumber: String,
      bankName: String,
      iban: String,
    },
    /** Missed-consult accountability counters (denormalized cache). */
    accountability: {
      totalMisses: { type: Number, default: 0 },
      currentMonthKey: { type: String },
      currentMonthMisses: { type: Number, default: 0 },
      lastMissAt: { type: Date },
      lastWarningAt: { type: Date },
      lastWarningMonthKey: { type: String },
      autoRestrictedAt: { type: Date },
      autoRestrictedMonthKey: { type: String },
    },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

applyFieldEncryption(nutritionistProfileSchema, {
  fields: [
    { path: "licenseNumber", kind: "string" },
    { path: "degree", kind: "string" },
    { path: "institute", kind: "string" },
    { path: "bio", kind: "string" },
    { path: "clinics", kind: "nestedArray", subFields: ["name", "address"] },
    { path: "intakeQuestions", kind: "nestedArray", subFields: ["text"] },
    { path: "rejectionReason", kind: "string" },
    { path: "bankAccount", kind: "object" },
  ],
});

// MongoDB cannot compound-index two array fields (specialties + clinics).
nutritionistProfileSchema.index({ specialties: 1, isListed: 1 });
nutritionistProfileSchema.index({ "clinics.city": 1, isListed: 1 });
nutritionistProfileSchema.index({ ratingAvg: -1, ratingCount: -1 });
nutritionistProfileSchema.index({ verificationStatus: 1, isListed: 1 });
nutritionistProfileSchema.index({ coverageCities: 1 });

export type NutritionistProfileDocument = InferSchemaType<
  typeof nutritionistProfileSchema
> & {
  _id: Types.ObjectId;
  verificationStatus: VerificationStatus;
};

export const NutritionistProfileModel: Model<NutritionistProfileDocument> =
  registerModel<NutritionistProfileDocument>(
    "NutritionistProfile",
    nutritionistProfileSchema,
  );
