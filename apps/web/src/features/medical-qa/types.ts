import type { MedicalQaCategory } from "@zindagi/validators";

export type MedicalQaProviderRole = "doctor" | "nurse" | "physiotherapist";

export type MedicalQaAuthorDto = {
  displayName: string;
  role: MedicalQaProviderRole | "patient";
  /** Resolved from current DoctorProfile/StaffProfile records at read time. */
  verified: boolean;
};

export type MedicalAnswerDto = {
  id: string;
  kind: "answer" | "follow_up";
  body: string;
  createdAt: string;
  author: MedicalQaAuthorDto;
};

export type MedicalQuestionSummaryDto = {
  id: string;
  category: MedicalQaCategory;
  title: string;
  excerpt: string;
  answerCount: number;
  photoCount: number;
  createdAt: string;
};

export type MedicalQuestionPhotoDto = { id: string; url: string; width: number; height: number };

export type MedicalQuestionDetailDto = {
  question: Omit<MedicalQuestionSummaryDto, "excerpt"> & { body: string };
  answers: MedicalAnswerDto[];
  /** null unless the viewer may see private photos (owner, verified provider, admin). */
  photos: MedicalQuestionPhotoDto[] | null;
  viewer: {
    isOwner: boolean;
    canAnswer: boolean;
    canFollowUp: boolean;
    canDelete: boolean;
    canReport: boolean;
    isSignedIn: boolean;
  };
};
