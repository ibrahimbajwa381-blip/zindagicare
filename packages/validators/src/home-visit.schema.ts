import { HomeVisitServiceTypes, HomeVisitStatuses, RefundMethods } from "@zindagi/shared";
import { z } from "zod";

const geoSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

export const createHomeVisitSchema = z.object({
  serviceType: z.enum([
    HomeVisitServiceTypes.DOCTOR_VISIT,
    HomeVisitServiceTypes.NURSE,
    HomeVisitServiceTypes.IV_DRIP,
    HomeVisitServiceTypes.INJECTION,
    HomeVisitServiceTypes.WOUND_CARE,
    HomeVisitServiceTypes.PHYSIOTHERAPY,
  ]),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  addressLine: z.string().min(5).max(300),
  city: z.string().default("Lahore"),
  geo: geoSchema,
  patientNotes: z.string().max(1000).optional(),
  autoAssign: z.boolean().default(false),
  /** Physiotherapy only: the physiotherapist (User id) the patient chose. */
  preferredStaffId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid provider").optional(),
});

export const assignHomeVisitSchema = z.object({
  staffId: z.string().min(1).optional(),
  auto: z.boolean().optional(),
  /** Allow assigning staff outside the home-care match radius (admin only). */
  override: z.boolean().optional(),
});

export const updateHomeVisitStatusSchema = z.object({
  status: z.enum([
    HomeVisitStatuses.ASSIGNED,
    HomeVisitStatuses.EN_ROUTE,
    HomeVisitStatuses.ARRIVED,
    HomeVisitStatuses.COMPLETED,
    HomeVisitStatuses.CANCELLED,
  ]),
  staffNotes: z.string().max(2000).optional(),
  cancellationReason: z.string().max(500).optional(),
  /** Required when a patient cancels a visit that's already been paid for. */
  refundMethod: z.enum([RefundMethods.BANK, RefundMethods.JAZZCASH, RefundMethods.EASYPAISA]).optional(),
  refundAccountTitle: z.string().min(1).max(100).optional(),
  refundAccountNumber: z.string().min(1).max(50).optional(),
  refundBankName: z.string().max(100).optional(),
});

export const listHomeVisitsQuerySchema = z.object({
  status: z.string().optional(),
  scope: z.enum(["mine", "assigned", "assigned-history", "pending", "all"]).optional(),
});

export type CreateHomeVisitInput = z.infer<typeof createHomeVisitSchema>;
export type AssignHomeVisitInput = z.infer<typeof assignHomeVisitSchema>;
export type UpdateHomeVisitStatusInput = z.infer<typeof updateHomeVisitStatusSchema>;
