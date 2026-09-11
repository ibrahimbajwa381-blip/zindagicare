import { SlotStatuses, type SlotStatus } from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * SundaySlotTemplate — recurring Sunday rules per doctor (referenced).
 * Small, rarely changes; materialized into SundaySlotInstance by cron.
 */
const sundaySlotTemplateSchema = new Schema(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "DoctorProfile",
      required: true,
      index: true,
    },
    dayOfWeek: { type: Number, default: 0, min: 0, max: 6 },
    startTimeLocal: { type: String, required: true },
    endTimeLocal: { type: String, required: true },
    slotDurationMins: { type: Number, default: 10, min: 5, max: 60 },
    maxSlots: { type: Number, default: 20, min: 1, max: 100 },
    timezone: { type: String, default: "Asia/Karachi" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

sundaySlotTemplateSchema.index({ doctorId: 1, isActive: 1 });

export type SundaySlotTemplateDocument = InferSchemaType<
  typeof sundaySlotTemplateSchema
> & { _id: Types.ObjectId };

export const SundaySlotTemplateModel: Model<SundaySlotTemplateDocument> =
  registerModel<SundaySlotTemplateDocument>(
    "SundaySlotTemplate",
    sundaySlotTemplateSchema,
  );

/**
 * SundaySlotInstance — one document per doctor per Sunday date.
 * Slots EMBEDDED (bounded ~20-100 subdocs) for atomic book + single read in slot picker.
 * Do NOT move slots to separate collection unless volume exceeds ~500/sunday/doctor.
 */
const embeddedSlotSchema = new Schema(
  {
    slotId: { type: String, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(SlotStatuses),
      default: SlotStatuses.AVAILABLE,
    },
    heldUntil: { type: Date },
    holdToken: { type: String },
    patientId: { type: Schema.Types.ObjectId, ref: "User" },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
  },
  { _id: false },
);

const sundaySlotInstanceSchema = new Schema(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "DoctorProfile",
      required: true,
    },
    /** Sunday date in Asia/Karachi as UTC midnight boundary — store normalized date */
    sundayDate: { type: Date, required: true },
    timezone: { type: String, default: "Asia/Karachi" },
    slots: { type: [embeddedSlotSchema], default: [] },
    materializedFromTemplateId: {
      type: Schema.Types.ObjectId,
      ref: "SundaySlotTemplate",
    },
  },
  { timestamps: true },
);

sundaySlotInstanceSchema.index({ doctorId: 1, sundayDate: 1 }, { unique: true });
sundaySlotInstanceSchema.index({ sundayDate: 1, "slots.status": 1 });
sundaySlotInstanceSchema.index({ "slots.slotId": 1 });

export type EmbeddedSlot = InferSchemaType<typeof embeddedSlotSchema> & {
  status: SlotStatus;
};

export type SundaySlotInstanceDocument = InferSchemaType<
  typeof sundaySlotInstanceSchema
> & {
  _id: Types.ObjectId;
  slots: EmbeddedSlot[];
};

export const SundaySlotInstanceModel: Model<SundaySlotInstanceDocument> =
  registerModel<SundaySlotInstanceDocument>(
    "SundaySlotInstance",
    sundaySlotInstanceSchema,
  );
