import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * PlanningItem — an entry on the admin Planning board, used to track how the
 * business is growing: strategic plans, monthly / city targets, hospital and
 * clinic partnerships, achievements, campaigns, open challenges and recurring
 * monthly costs. One model for all of them so the board can filter and group
 * across kinds.
 */
const planningItemSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["plan", "target", "partnership", "achievement", "campaign", "challenge", "expense"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 4000 },
    /** Empty means nationwide / not city-specific. */
    city: { type: String, maxlength: 80, index: true },
    status: {
      type: String,
      enum: ["planned", "in_progress", "on_hold", "done", "cancelled"],
      default: "planned",
    },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    owner: { type: String, maxlength: 120 },
    startDate: { type: Date },
    dueDate: { type: Date },

    /** Targets: the month the target is for, as YYYY-MM. */
    month: { type: String, match: /^\d{4}-\d{2}$/, index: true },
    /** Targets: what is measured. Monthly costs: the cost category. */
    metric: { type: String, maxlength: 120 },
    unit: { type: String, maxlength: 40 },
    targetValue: { type: Number, min: 0 },
    currentValue: { type: Number, min: 0 },

    /** Partnerships: hospitals, clinics, labs, pharmacies, etc. */
    partnerType: {
      type: String,
      enum: ["hospital", "clinic", "lab", "pharmacy", "university", "ngo", "corporate", "other"],
    },
    stage: {
      type: String,
      enum: ["prospect", "contacted", "negotiating", "signed", "active", "ended"],
    },
    contactName: { type: String, maxlength: 120 },
    contactPhone: { type: String, maxlength: 40 },

    /** Achievements: when it happened. */
    achievedAt: { type: Date },
    /** Campaigns: money spent. Monthly costs: amount per month. In PKR. */
    budget: { type: Number, min: 0 },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

planningItemSchema.index({ kind: 1, createdAt: -1 });

export type PlanningItemDocument = InferSchemaType<typeof planningItemSchema> & {
  _id: Types.ObjectId;
};

export const PlanningItemModel: Model<PlanningItemDocument> =
  registerModel<PlanningItemDocument>("PlanningItem", planningItemSchema);
