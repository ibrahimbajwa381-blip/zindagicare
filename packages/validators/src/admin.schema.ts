import {
  MAX_ADDITIONAL_SPECIALTIES,
  normalizeAdditionalSpecialties,
  SPECIALTIES,
} from "@zindagi/shared";
import { z } from "zod";
import { pakistaniPhoneSchema, weeklyAvailabilityEntrySchema } from "./auth.schema";
import { geoPointInputSchema } from "./geo.schema";
import { verifiedSpecialtiesSchema } from "./specialty.schema";

export const adminCreateDoctorSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  phone: z.string().optional(),
  pmdcNumber: z.string().min(3).max(30),
  /** First entry becomes primary; remainder additional + verified. */
  specialties: z.array(z.enum(SPECIALTIES)).min(1).max(5),
  sundayConsultEnabled: z.boolean().optional(),
});

const adminHospitalSchema = z.object({
  name: z.string().min(2, "Hospital name is required"),
  city: z.string().min(2, "City is required"),
  address: z.string().optional(),
});

const adminHomeVisitSchema = z
  .object({
    enabled: z.boolean(),
    area: z.string().min(2).optional(),
    geo: geoPointInputSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.enabled) return;
    if (!data.area?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Service area is required for in-house visits",
        path: ["area"],
      });
    }
    if (!data.geo) {
      ctx.addIssue({
        code: "custom",
        message: "Location is required for in-house visits",
        path: ["geo"],
      });
    }
  });

const timeLocalSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Use HH:mm format (e.g. 16:00)");

const specialtyEnum = z.enum(SPECIALTIES);

/**
 * Admin may update operational controls and full doctor profile content
 * (including credentials doctors cannot change themselves).
 */
export const adminUpdateDoctorSchema = z
  .object({
    isListed: z.boolean().optional(),
    isActive: z.boolean().optional(),
    homeVisitEnabled: z.boolean().optional(),
    homeVisitFee: z.number().min(0).max(50000).optional(),
    verificationStatus: z.enum(["approved", "rejected", "restricted"]).optional(),
    rejectionReason: z.string().min(3).max(500).optional(),
    sundayConsultEnabled: z.boolean().optional(),
    weeklyAvailability: z.array(weeklyAvailabilityEntrySchema).optional(),
    sundayMaxSlots: z.number().min(5).max(20).optional(),
    sundaySlotDurationMins: z.number().min(5).max(60).optional(),
    onlineCommissionPercent: z.number().min(0).max(100).nullable().optional(),
    homeVisitCommissionPercent: z.number().min(0).max(100).nullable().optional(),
    /** @deprecated Use onlineCommissionPercent / homeVisitCommissionPercent */
    commissionPercent: z.number().min(0).max(100).nullable().optional(),
    /** Replace admin-verified patient-visible specialties. */
    verifiedSpecialties: verifiedSpecialtiesSchema.optional(),
    primarySpecialty: specialtyEnum.optional(),
    additionalSpecialties: z
      .array(specialtyEnum)
      .max(MAX_ADDITIONAL_SPECIALTIES)
      .optional(),

    /** Profile identity / content (same fields doctors can self-edit). */
    name: z.string().min(2).max(100).optional(),
    phone: pakistaniPhoneSchema.optional(),
    avatarUrl: z.string().min(1).optional(),
    bio: z.string().max(2000).optional().nullable(),
    consultationFee: z.coerce.number().min(0).optional(),
    languages: z.array(z.string().trim().min(1)).min(1).optional(),
    hospitals: z.array(adminHospitalSchema).min(1).optional(),
    homeVisit: adminHomeVisitSchema.optional(),
    sundayConsult: z
      .object({
        enabled: z.boolean(),
        startTimeLocal: timeLocalSchema.optional(),
        endTimeLocal: timeLocalSchema.optional(),
        slotDurationMins: z.coerce.number().int().min(5).max(60).optional(),
      })
      .optional()
      .superRefine((data, ctx) => {
        if (!data?.enabled) return;
        if (!data.startTimeLocal) {
          ctx.addIssue({
            code: "custom",
            message: "Sunday start time is required",
            path: ["startTimeLocal"],
          });
        }
        if (!data.endTimeLocal) {
          ctx.addIssue({
            code: "custom",
            message: "Sunday end time is required",
            path: ["endTimeLocal"],
          });
        }
        if (
          data.startTimeLocal &&
          data.endTimeLocal &&
          data.endTimeLocal <= data.startTimeLocal
        ) {
          ctx.addIssue({
            code: "custom",
            message: "Sunday end time must be after start time",
            path: ["endTimeLocal"],
          });
        }
      }),

    /** Credentials — admin-only corrections. */
    pmdcNumber: z.string().min(4).max(32).optional(),
    medicalDegree: z.string().min(2).max(100).optional(),
    qualifications: z.array(z.string().trim().min(2).max(80)).max(12).optional(),
    medicalCollege: z.string().min(2).max(200).optional(),
    graduationYear: z.coerce
      .number()
      .int()
      .min(1950)
      .max(new Date().getFullYear())
      .optional(),
    experienceYears: z.coerce.number().int().min(0).max(60).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.additionalSpecialties !== undefined && data.primarySpecialty === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Primary specialty is required when updating specialties",
        path: ["primarySpecialty"],
      });
    }
  })
  .transform((data) => {
    if (data.primarySpecialty === undefined) {
      return data;
    }
    return {
      ...data,
      additionalSpecialties: normalizeAdditionalSpecialties(
        data.primarySpecialty,
        data.additionalSpecialties ?? [],
      ),
    };
  });

export const adminCancelAppointmentSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

export const adminReassignAppointmentSchema = z.object({
  doctorId: z.string().min(1),
});

export const adminRescheduleAppointmentSchema = z
  .object({
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
  })
  .refine((data) => new Date(data.scheduledEnd) > new Date(data.scheduledStart), {
    message: "End time must be after start time",
    path: ["scheduledEnd"],
  });

export const adminCreateManualAppointmentSchema = z
  .object({
    patientId: z.string().min(1).optional(),
    patientPhone: pakistaniPhoneSchema.optional(),
    patientName: z.string().min(2).max(100).optional(),
    doctorId: z.string().min(1),
    type: z.enum(["clinic", "online", "home_visit"]),
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
    patientNotes: z.string().max(1000).optional(),
    source: z.enum(["whatsapp", "phone", "walk_in"]).optional(),
  })
  .refine((data) => Boolean(data.patientId || data.patientPhone), {
    message: "Select an existing patient or provide a phone number",
    path: ["patientId"],
  })
  .refine((data) => new Date(data.scheduledEnd) > new Date(data.scheduledStart), {
    message: "End time must be after start time",
    path: ["scheduledEnd"],
  });

export const adminSundaySettingsSchema = z.object({
  sundayConsultEnabled: z.boolean().optional(),
  sundayDefaultMaxSlots: z.number().min(5).max(20).optional(),
  sundaySlotDurationMins: z.number().min(5).max(60).optional(),
});

export const adminCommissionSettingsSchema = z.object({
  defaultDoctorOnlineCommissionPercent: z.number().min(0).max(100).optional(),
  defaultDoctorHomeVisitCommissionPercent: z.number().min(0).max(100).optional(),
  defaultNurseCommissionPercent: z.number().min(0).max(100).optional(),
  defaultPhysiotherapistCommissionPercent: z.number().min(0).max(100).optional(),
});

export const adminSendNotificationSchema = z.object({
  title: z.string().min(2).max(200),
  body: z.string().min(2).max(1000),
  channel: z.enum(["in_app", "sms", "email"]),
  audience: z.enum(["all", "patients", "doctors", "user"]),
  userId: z.string().optional(),
  userEmail: z.string().email().optional(),
});

export const adminReviewModerationSchema = z.object({
  reviewId: z.string().min(1),
  action: z.enum(["approve", "hide", "show", "delete"]),
});

export const adminUpdatePatientSchema = z.object({
  isActive: z.boolean().optional(),
  /** Ban patient for N days from now */
  banDays: z.number().min(1).max(365).optional(),
  /** Clear platform ban */
  unban: z.boolean().optional(),
  /** Clear Sunday consult ban */
  clearSundayBan: z.boolean().optional(),
  /** Reset no-show counter */
  resetNoShowCount: z.boolean().optional(),
});

export const adminGrantSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.email || data.userId), {
    message: "Provide an email or userId",
  });

export const adminRevokeSchema = z.object({
  userId: z.string().min(1),
});
