import { OrderStatuses, type OrderStatus } from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { geoPointSchema } from "../schemas/geo.schema";
import { registerModel } from "../lib/register-model";

/**
 * Order — medicine delivery (Phase 2). Line items embedded (cart-sized, max ~50).
 * Pharmacy catalog SKUs referenced by id string until PharmacyProduct collection exists.
 */
const orderLineSchema = new Schema(
  {
    skuId: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    requiresPrescription: { type: Boolean, default: false },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, unique: true, required: true },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    prescriptionId: { type: Schema.Types.ObjectId, ref: "Prescription" },
    status: {
      type: String,
      enum: Object.values(OrderStatuses),
      default: OrderStatuses.DRAFT,
      index: true,
    },
    items: { type: [orderLineSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "PKR" },
    deliveryAddress: {
      line: String,
      city: String,
      geo: geoPointSchema,
    },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    riderId: { type: Schema.Types.ObjectId, ref: "User" },
    estimatedDeliveryAt: { type: Date },
    deliveredAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

orderSchema.index({ patientId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

export type OrderDocument = InferSchemaType<typeof orderSchema> & {
  _id: Schema.Types.ObjectId;
  status: OrderStatus;
};

export const OrderModel: Model<OrderDocument> = registerModel<OrderDocument>(
  "Order",
  orderSchema,
);
