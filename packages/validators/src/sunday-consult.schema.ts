import { z } from "zod";
import {
  PAID_ONLINE_INTAKE_QUESTION_KEYS,
  SundayAffordabilityChoices,
} from "@zindagi/shared";
import { pakistaniPhoneSchema } from "./auth.schema";

/**
 * Medical history — same question set as the paid online consult
 * (PAID_ONLINE_INTAKE_QUESTION_KEYS). Every question must be answered.
 */
export const sundayFreeHistorySchema = z
  .array(
    z.object({
      key: z.enum(PAID_ONLINE_INTAKE_QUESTION_KEYS),
      answer: z.string().trim().min(1, "Please answer every question").max(2000),
    }),
  )
  .refine(
    (answers) =>
      PAID_ONLINE_INTAKE_QUESTION_KEYS.every((key) => answers.some((a) => a.key === key)),
    { message: "Please answer every medical history question" },
  );

export const sundayFreeRequestSchema = z.object({
  patientPhone: pakistaniPhoneSchema,
  history: sundayFreeHistorySchema,
  locale: z.enum(["en", "ur"]).optional(),
  affordabilityChoice: z.enum([
    SundayAffordabilityChoices.CANNOT_AFFORD,
    SundayAffordabilityChoices.PAY_FEE,
  ]),
});

export type SundayFreeRequestInput = z.infer<typeof sundayFreeRequestSchema>;

/** Doctor picks an open Sunday request and chooses the consult time (PK local HH:mm). */
export const sundayFreeClaimSchema = z.object({
  startTimeLocal: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24-hour) time"),
});

export type SundayFreeClaimInput = z.infer<typeof sundayFreeClaimSchema>;

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
  city: z.string().optional(),
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
