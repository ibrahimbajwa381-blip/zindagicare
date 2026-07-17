import type { NextAuthConfig } from "next-auth";
import {
  canUseWorkspace,
  resolveDefaultWorkspace,
  Roles,
  type Role,
  type Workspace,
} from "@zindagi/shared";
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
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.roles = (user as { roles?: string[] }).roles ?? [Roles.PATIENT];
        const roles = (token.roles as Role[]) ?? [Roles.PATIENT];
        token.activeWorkspace =
          (user as { activeWorkspace?: Workspace }).activeWorkspace ??
          resolveDefaultWorkspace(roles);
        token.onboardingCompleted =
          (user as { onboardingCompleted?: boolean }).onboardingCompleted ?? false;
        token.hasPhone = (user as { hasPhone?: boolean }).hasPhone ?? false;
        token.doctorVerificationStatus = (
          user as { doctorVerificationStatus?: string }
        ).doctorVerificationStatus;
        token.nurseVerificationStatus = (
          user as { nurseVerificationStatus?: string }
        ).nurseVerificationStatus;
        token.physiotherapistVerificationStatus = (
          user as { physiotherapistVerificationStatus?: string }
        ).physiotherapistVerificationStatus;
        if (user.image) token.picture = user.image;
      }

      if (trigger === "update" && session) {
        const patch = session as {
          roles?: string[];
          activeWorkspace?: Workspace;
          onboardingCompleted?: boolean;
          hasPhone?: boolean;
          doctorVerificationStatus?: string;
          nurseVerificationStatus?: string;
          physiotherapistVerificationStatus?: string;
          image?: string;
        };
        if (patch.roles) {
          const roles = patch.roles as Role[];
          token.roles = roles;
          const activeWs = token.activeWorkspace as Workspace | undefined;
          if (activeWs && !canUseWorkspace(roles, activeWs)) {
            token.activeWorkspace = resolveDefaultWorkspace(roles);
          }
        }
        if (
          patch.activeWorkspace &&
          canUseWorkspace(token.roles as Role[], patch.activeWorkspace)
        ) {
          token.activeWorkspace = patch.activeWorkspace;
        }
        if (typeof patch.onboardingCompleted === "boolean") {
          token.onboardingCompleted = patch.onboardingCompleted;
        }
        if (typeof patch.hasPhone === "boolean") {
          token.hasPhone = patch.hasPhone;
        }
        if (patch.doctorVerificationStatus) {
          token.doctorVerificationStatus = patch.doctorVerificationStatus;
        }
        if (patch.nurseVerificationStatus) {
          token.nurseVerificationStatus = patch.nurseVerificationStatus;
        }
        if (patch.physiotherapistVerificationStatus) {
          token.physiotherapistVerificationStatus = patch.physiotherapistVerificationStatus;
        }
        if (patch.image) token.picture = patch.image;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roles = (token.roles as Role[]) ?? [Roles.PATIENT];
        session.user.activeWorkspace =
          (token.activeWorkspace as Workspace) ??
          resolveDefaultWorkspace(session.user.roles);
        session.user.onboardingCompleted =
          (token.onboardingCompleted as boolean) ?? false;
        session.user.hasPhone = token.hasPhone as boolean | undefined;
        session.user.doctorVerificationStatus = token.doctorVerificationStatus as
          | string
          | undefined;
        session.user.nurseVerificationStatus = token.nurseVerificationStatus as
          | string
          | undefined;
        session.user.physiotherapistVerificationStatus =
          token.physiotherapistVerificationStatus as string | undefined;
        session.user.image = (token.picture as string | undefined) ?? session.user.image;
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
