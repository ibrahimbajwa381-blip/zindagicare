import type { Role, VerificationStatus } from "@zindagi/shared";
import "next-auth";

declare module "next-auth" {
  interface User {
    roles?: Role[];
    onboardingCompleted?: boolean;
    doctorVerificationStatus?: VerificationStatus | string;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      roles?: Role[];
      onboardingCompleted?: boolean;
      doctorVerificationStatus?: VerificationStatus | string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: Role[];
    onboardingCompleted?: boolean;
    doctorVerificationStatus?: VerificationStatus | string;
  }
}
