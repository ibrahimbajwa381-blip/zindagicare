import { z } from "zod";
import { pakistaniPhoneSchema } from "./auth.schema";

export const urgentCareRequestSchema = z.object({
  patientPhone: pakistaniPhoneSchema,
  patientNotes: z.string().max(1000).optional(),
});

export type UrgentCareRequestInput = z.infer<typeof urgentCareRequestSchema>;

export const urgentCareAssignSchema = z.object({
  doctorId: z.string().min(1),
  adminNotes: z.string().max(2000).optional(),
});

export type UrgentCareAssignInput = z.infer<typeof urgentCareAssignSchema>;

export const urgentCareStatusSchema = z.object({
  status: z.enum(["completed", "cancelled"]),
  cancellationReason: z.string().max(500).optional(),
});

export type UrgentCareStatusInput = z.infer<typeof urgentCareStatusSchema>;

/** @deprecated MVP uses urgentCareRequestSchema */
export const urgentCheckoutSchema = urgentCareRequestSchema;
export type UrgentCheckoutInput = UrgentCareRequestInput;
