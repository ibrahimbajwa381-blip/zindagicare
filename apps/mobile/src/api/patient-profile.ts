import { apiFetch } from "./client";

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

/**
 * Mirrors packages/validators/src/patient-profile.schema.ts's
 * updatePatientProfileSchema (validated server-side on PATCH). Defined
 * locally rather than imported because that schema pulls in auth.schema.ts
 * -> specialty.schema.ts -> @zindagi/shared, which isn't RN-safe.
 */
export type UpdatePatientProfileInput = {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  locale?: "en" | "ur";
  dateOfBirth?: string | null;
  gender?: "male" | "female" | "other" | null;
  bloodGroup?: BloodGroup | null;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: { name?: string; phone?: string; relation?: string };
};

export type PatientProfileDto = {
  user: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    locale: "en" | "ur";
    city: string;
    memberSince: string;
  };
  profile: {
    dateOfBirth?: string;
    gender?: "male" | "female" | "other";
    bloodGroup?: BloodGroup;
    allergies: string[];
    chronicConditions: string[];
    emergencyContact?: { name?: string; phone?: string; relation?: string };
  };
};

export function getPatientProfile() {
  return apiFetch<PatientProfileDto>("/api/v1/patient/profile");
}

export function updatePatientProfile(input: UpdatePatientProfileInput) {
  return apiFetch<PatientProfileDto>("/api/v1/patient/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
