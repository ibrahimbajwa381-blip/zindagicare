import { z } from "zod";

const pakistaniPhone = z
  .string()
  .regex(/^(\+92|0)?3[0-9]{9}$/, "Enter a valid Pakistani mobile number");

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[0-9]/, "Include at least one number"),
  phone: pakistaniPhone,
});

export const otpRequestSchema = z.object({
  phone: pakistaniPhone,
});

export const otpVerifySchema = otpRequestSchema.extend({
  code: z.string().length(6, "Enter the 6-digit code"),
});

export const onboardingSchema = z.object({
  intent: z.enum(["patient", "doctor", "nurse", "rider"]),
  city: z.string().min(2, "City is required"),
  locale: z.enum(["en", "ur"]).default("en"),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

export const doctorVerificationSchema = z.object({
  pmdcNumber: z
    .string()
    .min(4, "PMDC number is required")
    .max(32, "PMDC number is too long"),
  cnic: z
    .string()
    .regex(/^[0-9]{5}-[0-9]{7}-[0-9]$/, "CNIC must be XXXXX-XXXXXXX-X"),
  medicalDegree: z.string().min(2, "Medical degree is required"),
  medicalCollege: z.string().min(2, "Medical college is required"),
  graduationYear: z.coerce
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear()),
  experienceYears: z.coerce.number().int().min(0).max(60),
  specialties: z.array(z.string().min(2)).min(1, "Select at least one specialty"),
  bio: z.string().max(2000).optional(),
  consultationFee: z.coerce.number().min(0).optional(),
  hospitals: z
    .array(
      z.object({
        name: z.string().min(2),
        city: z.string().min(2),
        address: z.string().optional(),
      }),
    )
    .min(1, "Add at least one practice location"),
  documentUrls: z.object({
    pmdcCertificate: z.string().url("PMDC certificate URL required"),
    cnicFront: z.string().url("CNIC front image required"),
    cnicBack: z.string().url("CNIC back image required"),
    degreeCertificate: z.string().url("Degree certificate required"),
  }),
});

export const adminDoctorDecisionSchema = z.object({
  doctorProfileId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(500).optional(),
});
