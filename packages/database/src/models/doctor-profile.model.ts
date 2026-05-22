import { VerificationStatuses, type VerificationStatus } from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
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
    medicalCollege: { type: String, trim: true },
    graduationYear: { type: Number, min: 1950 },
    verificationDocuments: {
      pmdcCertificate: String,
      cnicFront: String,
      cnicBack: String,
      degreeCertificate: String,
    },
    verificationSubmittedAt: { type: Date },
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
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    sundayConsultEnabled: { type: Boolean, default: false, index: true },
    sundaySlotDefaults: {
      durationMins: { type: Number, default: 10, min: 5, max: 60 },
      maxSlots: { type: Number, default: 20, min: 1, max: 100 },
    },
    coverageCities: { type: [String], default: ["Lahore"] },
    homeVisitEnabled: { type: Boolean, default: false },
    homeVisitFee: { type: Number, default: 0, min: 0 },
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
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

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
