import { z } from "zod";

export const copilotTriageLevelSchema = z.enum([
  "self_care",
  "book_consult",
  "urgent",
  "emergency",
]);

export const bookingSuggestionSchema = z.object({
  doctorId: z.string().min(1),
  doctorSlug: z.string().optional(),
  doctorName: z.string(),
  doctorAvatarUrl: z.string().optional(),
  specialty: z.string(),
  consultationFee: z.number(),
  slotId: z.string().min(1),
  slotStartAt: z.string(),
  slotEndAt: z.string(),
  pmdcVerified: z.boolean().optional(),
  ratingAvg: z.number().optional(),
  ratingCount: z.number().optional(),
});

export const doctorReferralSchema = z.object({
  doctorId: z.string(),
  slug: z.string().optional(),
  name: z.string(),
  avatarUrl: z.string().optional(),
  specialties: z.array(z.string()),
  consultationFee: z.number(),
  availableSlots: z.number(),
  pmdcVerified: z.boolean().optional(),
  ratingAvg: z.number().optional(),
  ratingCount: z.number().optional(),
});

export const bookedAppointmentSchema = z.object({
  appointmentId: z.string(),
  doctorName: z.string(),
  specialty: z.string(),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  consultationFee: z.number(),
  status: z.enum(["confirmed", "pending_payment"]),
  paymentId: z.string().optional(),
  dashboardHref: z.string().optional(),
});

export const actionLinkSchema = z.object({
  label: z.string(),
  href: z.string(),
});

export const appointmentPreviewSchema = z.object({
  appointmentId: z.string(),
  doctorName: z.string(),
  specialty: z.string(),
  scheduledStart: z.string(),
  status: z.string(),
  href: z.string(),
});

export const prescriptionPreviewSchema = z.object({
  prescriptionId: z.string(),
  doctorName: z.string(),
  createdAt: z.string(),
  href: z.string(),
});

export const urgentCareSuggestionSchema = z.object({
  href: z.string(),
  prefillNotes: z.string().optional(),
});

export const copilotMessageMetadataSchema = z.object({
  triageLevel: copilotTriageLevelSchema.optional(),
  bookingSuggestion: bookingSuggestionSchema.optional(),
  doctorReferrals: z.array(doctorReferralSchema).optional(),
  bookedAppointment: bookedAppointmentSchema.optional(),
  urgentCareSuggestion: urgentCareSuggestionSchema.optional(),
  actionLinks: z.array(actionLinkSchema).optional(),
  appointmentPreviews: z.array(appointmentPreviewSchema).optional(),
  prescriptionPreviews: z.array(prescriptionPreviewSchema).optional(),
});

export const createCopilotSessionSchema = z.object({
  locale: z.enum(["en", "ur"]).optional(),
});

export const listCopilotSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const listCopilotMessagesQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const sendCopilotMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  locale: z.enum(["en", "ur"]).optional(),
  inputMode: z.enum(["voice", "text"]).optional(),
});

export type BookingSuggestionPayload = z.infer<typeof bookingSuggestionSchema>;
export type DoctorReferralPayload = z.infer<typeof doctorReferralSchema>;
export type BookedAppointmentPayload = z.infer<typeof bookedAppointmentSchema>;
export type CopilotMessageMetadata = z.infer<typeof copilotMessageMetadataSchema>;
export type CreateCopilotSessionInput = z.infer<typeof createCopilotSessionSchema>;
export type SendCopilotMessageInput = z.infer<typeof sendCopilotMessageSchema>;
