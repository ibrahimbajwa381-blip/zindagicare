import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * Testimonial — a general platform experience review shown on the public site.
 * Not tied to a specific appointment/doctor (unlike Review). Visible by default on submit.
 */
const testimonialSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    /** Free-text display name — used for admin-entered testimonials with no linked account. */
    patientName: { type: String, required: true, maxlength: 100 },
    rating: { type: Number, min: 1, max: 5 },
    content: { type: String, required: true, maxlength: 3000 },
    isVisible: { type: Boolean, default: true },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
    /** "patient" = submitted via app; "admin" = entered by staff on a patient's behalf; "public" = submitted via the shareable public link (no account). */
    source: { type: String, enum: ["patient", "admin", "public"], default: "patient" },
  },
  { timestamps: true },
);

testimonialSchema.index({ isVisible: 1, createdAt: -1 });

export type TestimonialDocument = InferSchemaType<typeof testimonialSchema> & {
  _id: Schema.Types.ObjectId;
};

export const TestimonialModel: Model<TestimonialDocument> = registerModel<TestimonialDocument>(
  "Testimonial",
  testimonialSchema,
);
