import type { NextAuthConfig } from "next-auth";
import { Roles, type Role } from "@zindagi/shared";
import { isPublicPath } from "./routes";

/**
 * Edge-safe Auth.js config — no Mongoose, bcrypt, or Node-only imports.
 * Used by proxy. Providers are added in auth.ts (Node runtime only).
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.roles = (user as { roles?: string[] }).roles ?? [Roles.PATIENT];
        token.onboardingCompleted =
          (user as { onboardingCompleted?: boolean }).onboardingCompleted ?? false;
        token.doctorVerificationStatus = (
          user as { doctorVerificationStatus?: string }
        ).doctorVerificationStatus;
      }

      if (trigger === "update" && session) {
        const patch = session as {
          roles?: string[];
          onboardingCompleted?: boolean;
          doctorVerificationStatus?: string;
        };
        if (patch.roles) token.roles = patch.roles;
        if (typeof patch.onboardingCompleted === "boolean") {
          token.onboardingCompleted = patch.onboardingCompleted;
        }
        if (patch.doctorVerificationStatus) {
          token.doctorVerificationStatus = patch.doctorVerificationStatus;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roles = (token.roles as Role[]) ?? [Roles.PATIENT];
        session.user.onboardingCompleted =
          (token.onboardingCompleted as boolean) ?? false;
        session.user.doctorVerificationStatus = token.doctorVerificationStatus as
          | string
          | undefined;
      }
      return session;
    },
    authorized({ auth, request }) {
      if (isPublicPath(request.nextUrl.pathname)) return true;
      return !!auth?.user;
    },
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
} satisfies NextAuthConfig;
