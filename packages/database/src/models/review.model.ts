import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * Review — one per completed appointment (unique appointmentId).
 * Denormalized doctorId for listing without join; rating drives DoctorProfile aggregates.
 */
const reviewSchema = new Schema(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      unique: true,
      sparse: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "DoctorProfile",
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    /** Which provider role the review is about. Defaults to "doctor". */
    providerRole: {
      type: String,
      enum: ["doctor", "herbalist", "nutritionist"],
      default: "doctor",
      index: true,
    },
    /** Provider profile id for non-doctor providers (mirrors doctorId for doctors). */
    providerProfileId: { type: Schema.Types.ObjectId, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 2000 },
    isModerated: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
    /** "patient" = submitted via app after a consult; "admin" = entered by staff for an off-platform review. */
    source: { type: String, enum: ["patient", "admin"], default: "patient" },
    /** Free-text display name for admin-entered reviews (no real patient account). */
    patientName: { type: String, maxlength: 100 },
  },
  { timestamps: true },
);

reviewSchema.index({ doctorId: 1, isVisible: 1, createdAt: -1 });
reviewSchema.index({ patientId: 1, createdAt: -1 });

export type ReviewDocument = InferSchemaType<typeof reviewSchema> & {
  _id: Schema.Types.ObjectId;
};

export const ReviewModel: Model<ReviewDocument> = registerModel<ReviewDocument>(
  "Review",
  reviewSchema,
);
