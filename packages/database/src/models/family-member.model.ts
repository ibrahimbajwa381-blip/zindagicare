import { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { registerModel } from "../lib/register-model";

/**
 * FamilyMember — referenced dependents (may or may not have User login).
 * Embedded on User would grow unbounded; separate collection supports book-on-behalf queries.
 */
const familyMemberSchema = new Schema(
  {
    headUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    memberUserId: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    name: { type: String, required: true },
    relation: {
      type: String,
      enum: ["spouse", "child", "parent", "sibling", "other"],
      required: true,
    },
    dateOfBirth: { type: Schema.Types.Mixed },
    gender: { type: String, enum: ["male", "female", "other"] },
    canBookOnBehalf: { type: Boolean, default: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

applyFieldEncryption(familyMemberSchema, {
  fields: [
    { path: "name", kind: "string" },
    { path: "dateOfBirth", kind: "date" },
  ],
});

familyMemberSchema.index({ headUserId: 1, name: 1 });

export type FamilyMemberDocument = InferSchemaType<
  typeof familyMemberSchema
> & { _id: Schema.Types.ObjectId };

export const FamilyMemberModel: Model<FamilyMemberDocument> =
  registerModel<FamilyMemberDocument>("FamilyMember", familyMemberSchema);
