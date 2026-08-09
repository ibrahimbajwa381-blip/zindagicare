import { z } from "zod";

export const adminCreateDoctorSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  phone: z.string().optional(),
  pmdcNumber: z.string().min(3).max(30),
  specialties: z.array(z.string().min(1)).min(1).max(5),
  sundayConsultEnabled: z.boolean().optional(),
});

export const adminUpdateDoctorSchema = z.object({
  isListed: z.boolean().optional(),
  isActive: z.boolean().optional(),
  homeVisitEnabled: z.boolean().optional(),
  homeVisitFee: z.number().min(0).max(50000).optional(),
  verificationStatus: z.enum(["approved", "rejected", "restricted"]).optional(),
  rejectionReason: z.string().min(3).max(500).optional(),
  sundayConsultEnabled: z.boolean().optional(),
  weeklyAvailability: z
    .array(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTimeLocal: z.string().regex(/^\d{2}:\d{2}$/),
        endTimeLocal: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .optional(),
  sundayMaxSlots: z.number().min(5).max(20).optional(),
  sundaySlotDurationMins: z.number().min(5).max(60).optional(),
  onlineCommissionPercent: z.number().min(0).max(100).nullable().optional(),
  homeVisitCommissionPercent: z.number().min(0).max(100).nullable().optional(),
  /** @deprecated Use onlineCommissionPercent / homeVisitCommissionPercent */
  commissionPercent: z.number().min(0).max(100).nullable().optional(),
});

export const adminCancelAppointmentSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

export const adminReassignAppointmentSchema = z.object({
  doctorId: z.string().min(1),
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
