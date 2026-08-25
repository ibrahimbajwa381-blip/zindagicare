import { z } from "zod";
import { geoPointInputSchema } from "./geo.schema";
import { pakistaniPhoneSchema } from "./auth.schema";

export const updateNurseProfileSchema = z.object({
  name: z.string().min(2, "Name is required").optional(),
  phone: pakistaniPhoneSchema.optional(),
  city: z.string().min(2, "City is required").optional(),
  area: z.string().min(2, "Area / neighborhood is required").optional(),
  geo: geoPointInputSchema.optional(),
  radiusKm: z
    .number()
    .min(1, "Radius must be at least 1 km")
    .max(50, "Radius cannot exceed 50 km")
    .optional(),
  homeVisitEnabled: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

export type UpdateNurseProfileInput = z.infer<typeof updateNurseProfileSchema>;

const nurseServiceAreaSchema = z
  .object({
    city: z.string().min(2, "City is required"),
    area: z.string().min(2, "Area / neighborhood is required"),
    homeVisitEnabled: z.boolean(),
    geo: geoPointInputSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.homeVisitEnabled && !data.geo) {
      ctx.addIssue({
        code: "custom",
        message: "Google Maps location is required for in-house visits",
        path: ["geo"],
      });
    }
  });

export const nurseVerificationSchema = z.object({
  licenseNumber: z
    .string()
    .min(3, "License / registration number is required")
    .max(40, "License number is too long"),
  cnic: z
    .string()
    .regex(/^[0-9]{5}-[0-9]{7}-[0-9]$/, "CNIC must be XXXXX-XXXXXXX-X"),
  qualification: z
    .string()
    .min(2, "Qualification is required")
    .max(120, "Qualification is too long"),
  experienceYears: z.coerce.number().min(0).max(60),
  serviceArea: nurseServiceAreaSchema,
  documentUrls: z.object({
    licenseCertificate: z.string().min(1, "License certificate required"),
    cnicFront: z.string().min(1, "CNIC front image required"),
    cnicBack: z.string().min(1, "CNIC back image required"),
  }),
  acceptedProviderAgreement: z.literal(true, {
    message: "You must accept the ZindagiCare Provider Agreement",
  }),
});

export type NurseVerificationInput = z.infer<typeof nurseVerificationSchema>;

export const adminNurseDecisionSchema = z.object({
  staffProfileId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(500).optional(),
});

export type AdminNurseDecisionInput = z.infer<typeof adminNurseDecisionSchema>;

export const adminNurseNotesSchema = z.object({
  notes: z.string().max(5000),
});

export type AdminNurseNotesInput = z.infer<typeof adminNurseNotesSchema>;

export const updatePhysiotherapistProfileSchema = updateNurseProfileSchema;
export type UpdatePhysiotherapistProfileInput = z.infer<
  typeof updatePhysiotherapistProfileSchema
>;

export const physiotherapistVerificationSchema = nurseVerificationSchema;
export type PhysiotherapistVerificationInput = z.infer<
  typeof physiotherapistVerificationSchema
>;

export const adminPhysiotherapistDecisionSchema = adminNurseDecisionSchema;
export type AdminPhysiotherapistDecisionInput = z.infer<
  typeof adminPhysiotherapistDecisionSchema
>;

export const adminPhysiotherapistNotesSchema = adminNurseNotesSchema;
export type AdminPhysiotherapistNotesInput = z.infer<
  typeof adminPhysiotherapistNotesSchema
>;

export const convertDoctorToPhysiotherapistSchema = z.object({
  doctorProfileId: z.string().min(1),
});
export type ConvertDoctorToPhysiotherapistInput = z.infer<
  typeof convertDoctorToPhysiotherapistSchema
>;
