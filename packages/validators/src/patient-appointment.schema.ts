import { z } from "zod";
import { RefundMethods } from "@zindagi/shared";

/**
 * Patient applies for a full refund by requesting to cancel a booked appointment.
 * Collects the reason plus where the admin should manually send the money.
 */
export const requestAppointmentCancellationSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
    refundMethod: z.enum([
      RefundMethods.BANK,
      RefundMethods.JAZZCASH,
      RefundMethods.EASYPAISA,
    ]),
    refundAccountTitle: z.string().trim().min(2).max(100),
    refundAccountNumber: z.string().trim().min(5).max(50),
    refundBankName: z.string().trim().min(2).max(100).optional(),
  })
  .refine(
    (data) => data.refundMethod !== RefundMethods.BANK || Boolean(data.refundBankName?.trim()),
    { message: "Bank name is required for bank transfers", path: ["refundBankName"] },
  );

export type RequestAppointmentCancellationInput = z.infer<
  typeof requestAppointmentCancellationSchema
>;
