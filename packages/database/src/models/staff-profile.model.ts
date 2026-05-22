import { Roles } from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
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
        geo: geoPointSchema,
        radiusKm: { type: Number, default: 10 },
      },
    ],
    isAvailable: { type: Boolean, default: true, index: true },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

staffProfileSchema.index({ staffType: 1, isAvailable: 1 });

export type StaffProfileDocument = InferSchemaType<
  typeof staffProfileSchema
> & { _id: Schema.Types.ObjectId };

export const StaffProfileModel: Model<StaffProfileDocument> =
  registerModel<StaffProfileDocument>("StaffProfile", staffProfileSchema);
