import type { Role, VerificationStatus, Workspace } from "@zindagi/shared";
import "next-auth";

declare module "next-auth" {
  interface User {
    roles?: Role[];
    activeWorkspace?: Workspace;
    onboardingCompleted?: boolean;
    hasPhone?: boolean;
    doctorVerificationStatus?: VerificationStatus | string;
    nurseVerificationStatus?: VerificationStatus | string;
    physiotherapistVerificationStatus?: VerificationStatus | string;
    herbalistVerificationStatus?: VerificationStatus | string;
    nutritionistVerificationStatus?: VerificationStatus | string;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      roles?: Role[];
      activeWorkspace?: Workspace;
      onboardingCompleted?: boolean;
      hasPhone?: boolean;
      doctorVerificationStatus?: VerificationStatus | string;
      nurseVerificationStatus?: VerificationStatus | string;
      physiotherapistVerificationStatus?: VerificationStatus | string;
      herbalistVerificationStatus?: VerificationStatus | string;
      nutritionistVerificationStatus?: VerificationStatus | string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: Role[];
    activeWorkspace?: Workspace;
    onboardingCompleted?: boolean;
    hasPhone?: boolean;
    doctorVerificationStatus?: VerificationStatus | string;
    nurseVerificationStatus?: VerificationStatus | string;
    physiotherapistVerificationStatus?: VerificationStatus | string;
    herbalistVerificationStatus?: VerificationStatus | string;
    nutritionistVerificationStatus?: VerificationStatus | string;
  }
}
