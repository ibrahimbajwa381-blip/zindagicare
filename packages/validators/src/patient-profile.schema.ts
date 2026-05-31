import { z } from "zod";
import { pakistaniPhoneSchema } from "./auth.schema";

export const updatePatientProfileSchema = z.object({
  name: z.string().min(2, "Name is required").optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .optional(),
  phone: pakistaniPhoneSchema.optional(),
  city: z.string().min(2, "City is required").optional(),
  locale: z.enum(["en", "ur"]).optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .optional()
    .nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional()
    .nullable(),
  allergies: z.array(z.string().trim().min(1)).optional(),
  chronicConditions: z.array(z.string().trim().min(1)).optional(),
  emergencyContact: z
    .object({
      name: z.string().trim().optional(),
      phone: z.string().trim().optional(),
      relation: z.string().trim().optional(),
    })
    .optional(),
});

export type UpdatePatientProfileInput = z.infer<typeof updatePatientProfileSchema>;
