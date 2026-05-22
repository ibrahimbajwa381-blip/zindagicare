import {
  PaymentProviders,
  PaymentStatuses,
  type PaymentProvider,
  type PaymentStatus,
} from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * Payment — idempotent gateway records. Polymorphic refs (one primary entity per payment).
 */
const paymentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(PaymentProviders),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatuses),
      default: PaymentStatuses.PENDING,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "PKR" },
    externalTransactionId: { type: String, sparse: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    homeVisitId: { type: Schema.Types.ObjectId, ref: "HomeVisit" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true },
);

paymentSchema.index({ provider: 1, externalTransactionId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export type PaymentDocument = InferSchemaType<typeof paymentSchema> & {
  _id: Schema.Types.ObjectId;
  provider: PaymentProvider;
  status: PaymentStatus;
};

export const PaymentModel: Model<PaymentDocument> = registerModel<PaymentDocument>(
  "Payment",
  paymentSchema,
);
