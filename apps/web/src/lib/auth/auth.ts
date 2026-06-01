import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { Roles } from "@zindagi/shared";
import { authConfig } from "./auth.config";
import {
  findOrCreateGoogleUser,
  findOrCreatePhoneUser,
  loadAuthUserPayload,
  verifyCredentialsLogin,
} from "@/server/services/auth.service";
import { otpService } from "@/server/services/otp.service";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
<<<<<<< HEAD
      clientSecret: process.env.GOGLE_CLIENT_SECRET,
=======
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
>>>>>>> de54e62 (google verification)
      allowDangerousEmailAccountLinking: false,
    }),
    Credentials({
      id: "credentials",
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        return verifyCredentialsLogin(email, password);
      },
    }),
    Credentials({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        code: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.code) {
          return null;
        }

        const phone = String(credentials.phone);
        const code = String(credentials.code);

        const valid = await otpService.verifyOtp(phone, code);
        if (!valid) {
          return null;
        }

        const user = await findOrCreatePhoneUser(phone);
        const payload = await loadAuthUserPayload(user._id.toString());
        return payload;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const dbUser = await findOrCreateGoogleUser({
          email: user.email,
          name: user.name ?? "Google User",
          image: user.image,
        });
        const payload = await loadAuthUserPayload(dbUser._id.toString());
        if (!payload) return false;
        Object.assign(user, payload);
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.roles = user.roles ?? [Roles.PATIENT];
        token.onboardingCompleted = user.onboardingCompleted ?? false;
        token.doctorVerificationStatus = user.doctorVerificationStatus;
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
  },
});
