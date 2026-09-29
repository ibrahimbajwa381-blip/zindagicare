import { z } from "zod";

export const listConsultDoctorsQuerySchema = z.object({
  city: z.string().optional(),
  specialty: z.string().optional(),
});

export const listConsultSlotsQuerySchema = z.object({
  doctorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const bookConsultSchema = z.object({
  doctorId: z.string().min(1),
  slotId: z.string().min(1),
  patientNotes: z.string().max(500).optional(),
  locale: z.enum(["en", "ur"]).optional(),
});

export type ListConsultDoctorsQuery = z.infer<typeof listConsultDoctorsQuerySchema>;
export type ListConsultSlotsQuery = z.infer<typeof listConsultSlotsQuerySchema>;
export type BookConsultInput = z.infer<typeof bookConsultSchema>;
