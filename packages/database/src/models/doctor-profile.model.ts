import { VerificationStatuses, type VerificationStatus } from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { geoPointSchema } from "../schemas/geo.schema";
import { registerModel } from "../lib/register-model";

/**
 * DoctorProfile — 1:1 with User when role includes doctor.
 * Referenced (not embedded on User) so doctor listings don't load auth fields.
 * Denormalized ratingAvg/ratingCount for sort (updated by Review service).
 */
const doctorProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    pmdcNumber: { type: String, trim: true },
    pmdcVerified: { type: Boolean, default: false },
    cnicHash: { type: String, select: false },
    cnicLast4: { type: String },
    medicalDegree: { type: String, trim: true },
    /** Postgraduate and fellowship qualifications, e.g. FCPS, MCPS, MRCP. */
    qualifications: { type: [String], default: [] },
    medicalCollege: { type: String, trim: true },
    graduationYear: { type: Number, min: 1950 },
    verificationDocuments: {
      pmdcCertificate: String,
      cnicFront: String,
      cnicBack: String,
      degreeCertificate: String,
    },
    verificationSubmittedAt: { type: Date },
    /** Anti-circumvention / off-platform payment policy acceptance, captured at verification submit. */
    platformAgreementAcceptedAt: { type: Date },
    platformAgreementVersion: { type: String },
    /**
     * Doctor-chosen primary specialty (required after verification submit).
     * Patient-facing listing uses `specialties` (admin-verified) only.
     */
    primarySpecialty: { type: String, trim: true },
    /** Doctor-requested additional specialties (may include unverified ones). */
    additionalSpecialties: { type: [String], default: [] },
    /**
     * Admin-verified specialties visible to patients for search/booking.
     * Subset of claimed specialties (primary + additional).
     */
    specialties: { type: [String], default: [], index: true },
    experienceYears: { type: Number, default: 0, min: 0 },
    bio: { type: String, maxlength: 2000 },
    languages: { type: [String], default: ["English", "Urdu"] },
    hospitals: [
      {
        name: { type: String, required: true },
        city: { type: String, required: true, index: true },
        address: String,
        geo: geoPointSchema,
      },
    ],
    consultationFee: { type: Number, default: 0, min: 0 },
    videoConsultEnabled: { type: Boolean, default: false },
    /** On-call for urgent video consults (5–10 min match) */
    urgentConsultEnabled: { type: Boolean, default: false, index: true },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    sundayConsultEnabled: { type: Boolean, default: false, index: true },
    sundaySlotDefaults: {
      durationMins: { type: Number, default: 10, min: 5, max: 60 },
      maxSlots: { type: Number, default: 20, min: 1, max: 100 },
    },
    /** General weekly clinic hours (day 0 = Sunday … 6 = Saturday, times in Asia/Karachi). */
    weeklyAvailability: [
      {
        dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
        startTimeLocal: { type: String, required: true },
        endTimeLocal: { type: String, required: true },
      },
    ],
    /** Pre-consult intake questions; empty/absent means use DEFAULT_INTAKE_QUESTIONS. */
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
    homeVisitEnabled: { type: Boolean, default: false },
    homeVisitLocation: {
      area: String,
      geo: geoPointSchema,
    },
    homeVisitFee: { type: Number, default: 0, min: 0 },
    /** Override for online/clinic consult revenue share (0–100). Null uses platform default. */
    onlineCommissionPercent: { type: Number, min: 0, max: 100, default: null },
    /** Override for in-house visit revenue share (0–100). Null uses platform default. */
    homeVisitCommissionPercent: { type: Number, min: 0, max: 100, default: null },
    /** @deprecated Legacy single override — applies to both channels when channel override is null */
    commissionPercent: { type: Number, min: 0, max: 100, default: null },
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
    isListed: { type: Boolean, default: false },
    /** Payout destination for admin-initiated manual payouts. */
    bankAccount: {
      accountTitle: String,
      accountNumber: String,
      bankName: String,
      iban: String,
    },
    /**
     * Missed-consult accountability. `currentMonth*` is a denormalized cache for fast
     * display/decisions; the source of truth is the DoctorMiss strike log.
     */
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

applyFieldEncryption(doctorProfileSchema, {
  fields: [
    { path: "pmdcNumber", kind: "string" },
    { path: "medicalDegree", kind: "string" },
    { path: "medicalCollege", kind: "string" },
    { path: "bio", kind: "string" },
    {
      path: "hospitals",
      kind: "nestedArray",
      subFields: ["name", "address"],
    },
    {
      path: "intakeQuestions",
      kind: "nestedArray",
      subFields: ["text"],
    },
    { path: "rejectionReason", kind: "string" },
    { path: "homeVisitLocation.area", kind: "string" },
    { path: "bankAccount", kind: "object" },
  ],
});

// MongoDB cannot compound-index two array fields (specialties + hospitals).
doctorProfileSchema.index({ specialties: 1, isListed: 1 });
doctorProfileSchema.index({ "hospitals.city": 1, isListed: 1 });
doctorProfileSchema.index({ ratingAvg: -1, ratingCount: -1 });
doctorProfileSchema.index({
  verificationStatus: 1,
  sundayConsultEnabled: 1,
  isListed: 1,
});
doctorProfileSchema.index({ coverageCities: 1 });

export type DoctorProfileDocument = InferSchemaType<
  typeof doctorProfileSchema
> & {
  _id: Schema.Types.ObjectId;
  verificationStatus: VerificationStatus;
};

export const DoctorProfileModel: Model<DoctorProfileDocument> =
  registerModel<DoctorProfileDocument>("DoctorProfile", doctorProfileSchema);
