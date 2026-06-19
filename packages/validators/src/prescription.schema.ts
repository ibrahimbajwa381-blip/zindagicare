import { z } from "zod";

const medicationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().min(1).max(100),
  frequency: z.string().trim().min(1).max(100),
  duration: z.string().trim().min(1).max(100),
});

export const createPrescriptionSchema = z.object({
  appointmentId: z.string().min(1),
  medications: z.array(medicationSchema).min(1).max(20),
  notes: z.string().trim().max(2000).optional(),
});

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type PrescriptionMedicationInput = z.infer<typeof medicationSchema>;
