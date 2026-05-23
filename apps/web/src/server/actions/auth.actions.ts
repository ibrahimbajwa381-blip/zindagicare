"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn } from "@/lib/auth";
import { registerWithCredentials } from "@/server/services/auth.service";
import { AppError } from "@zindagi/shared";
import { loginSchema, registerSchema } from "@zindagi/validators";

function buildCredentialsFormData(
  fields: Record<string, string>,
  redirectTo: string,
) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  formData.set("redirectTo", redirectTo);
  return formData;
}

export async function loginWithCredentialsAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const callbackUrl = String(formData.get("callbackUrl") || "/dashboard");

  try {
    await signIn(
      "credentials",
      buildCredentialsFormData(
        {
          email: parsed.data.email,
          password: parsed.data.password,
        },
        callbackUrl,
      ),
    );
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (e instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw e;
  }
}

export async function registerAction(
  _prev: { error?: string; success?: boolean } | undefined,
  formData: FormData,
) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await registerWithCredentials(parsed.data);
    await signIn(
      "credentials",
      buildCredentialsFormData(
        {
          email: parsed.data.email,
          password: parsed.data.password,
        },
        "/onboarding",
      ),
    );
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (e instanceof AppError && e.code === "CONFLICT") {
      return { error: "An account with this email or phone already exists" };
    }
    if (e instanceof AuthError) {
      return {
        error:
          "Account created but sign-in failed. Please log in with your email and password.",
      };
    }
    throw e;
  }
}

export async function loginWithGoogleAction(callbackUrl?: string) {
  await signIn("google", {
    redirectTo: callbackUrl ?? "/onboarding",
  });
}

export async function loginWithPhoneOtpAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const phone = String(formData.get("phone") ?? "");
  const code = String(formData.get("code") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") || "/dashboard");

  if (!phone || !code) {
    return { error: "Phone and OTP code are required" };
  }

  try {
    await signIn(
      "phone-otp",
      buildCredentialsFormData({ phone, code }, callbackUrl),
    );
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (e instanceof AuthError) {
      return { error: "Invalid or expired OTP" };
    }
    throw e;
  }
}
