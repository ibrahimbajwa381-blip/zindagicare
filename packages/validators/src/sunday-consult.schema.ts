import { z } from "zod";

export const reserveSlotSchema = z.object({
  doctorId: z.string().min(1),
  instanceId: z.string().min(1),
  slotId: z.string().min(1),
});

export const confirmBookingSchema = z.object({
  doctorId: z.string().min(1),
  instanceId: z.string().min(1),
  slotId: z.string().min(1),
  holdToken: z.string().min(1),
  patientNotes: z.string().max(500).optional(),
  locale: z.enum(["en", "ur"]).optional(),
});

export const releaseHoldSchema = z.object({
  instanceId: z.string().min(1),
  slotId: z.string().min(1),
  holdToken: z.string().min(1),
});

export const upsertTemplateSchema = z.object({
  startTimeLocal: z.string().regex(/^\d{2}:\d{2}$/),
  endTimeLocal: z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMins: z.number().min(5).max(60).default(10),
  maxSlots: z.number().min(1).max(100).default(20),
  isActive: z.boolean().default(true),
});

export const toggleSundaySchema = z.object({
  enabled: z.boolean(),
});

export const appointmentStatusSchema = z.object({
  appointmentId: z.string().min(1),
  status: z.enum(["completed", "no_show", "cancelled"]),
  doctorNotes: z.string().max(2000).optional(),
});

export const listDoctorsQuerySchema = z.object({
  city: z.string().default("Lahore"),
  date: z.string().optional(),
});

export const listSlotsQuerySchema = z.object({
  doctorId: z.string().min(1),
  date: z.string().optional(),
});

export type ReserveSlotInput = z.infer<typeof reserveSlotSchema>;
export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;
export type ReleaseHoldInput = z.infer<typeof releaseHoldSchema>;
export type UpsertTemplateInput = z.infer<typeof upsertTemplateSchema>;
export type ToggleSundayInput = z.infer<typeof toggleSundaySchema>;
export type AppointmentStatusInput = z.infer<typeof appointmentStatusSchema>;
