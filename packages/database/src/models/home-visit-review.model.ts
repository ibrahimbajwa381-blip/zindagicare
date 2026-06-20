import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * HomeVisitReview — one per completed home visit (unique homeVisitId).
 */
const homeVisitReviewSchema = new Schema(
  {
    homeVisitId: {
      type: Schema.Types.ObjectId,
      ref: "HomeVisit",
      required: true,
      unique: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    staffUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 2000 },
    isModerated: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

homeVisitReviewSchema.index({ staffUserId: 1, isVisible: 1, createdAt: -1 });
homeVisitReviewSchema.index({ patientId: 1, createdAt: -1 });

export type HomeVisitReviewDocument = InferSchemaType<typeof homeVisitReviewSchema> & {
  _id: Schema.Types.ObjectId;
};

export const HomeVisitReviewModel: Model<HomeVisitReviewDocument> =
  registerModel<HomeVisitReviewDocument>("HomeVisitReview", homeVisitReviewSchema);
