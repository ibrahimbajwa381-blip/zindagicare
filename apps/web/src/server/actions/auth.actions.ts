"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn } from "@/lib/auth";
import { authActionErrorMessage } from "@/lib/auth/errors";
import { getLocale } from "@/i18n/server";
import {
  authMessage,
  authValidationMessage,
  conflictFieldError,
  fieldErrorsFromZodIssues,
  type AuthFormField,
} from "@/lib/auth/validation-messages";

export type RegisterFormState = {
  fieldErrors?: Partial<Record<AuthFormField, string>>;
  error?: string;
};
import { registerWithCredentials } from "@/server/services/auth.service";
import { AppError } from "@zindagi/shared";
import { loginSchema, otpVerifySchema, registerSchema } from "@zindagi/validators";

async function signInWithProvider(
  provider: "credentials" | "phone-otp",
  fields: Record<string, string>,
  redirectTo: string,
) {
  const result = await signIn(provider, {
    ...fields,
    redirectTo,
    redirect: false,
  });

  if (typeof result === "string" && result.includes("error=")) {
    throw new CredentialsSignin();
  }

  redirect(redirectTo);
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
    const locale = await getLocale();
    const field = parsed.error.issues[0]?.path[0]?.toString();
    return { error: authValidationMessage(locale, field) };
  }

  const callbackUrl = String(formData.get("callbackUrl") || "/dashboard");

  try {
    await signInWithProvider(
      "credentials",
      {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      callbackUrl,
    );
  } catch (e) {
    if (isRedirectError(e)) throw e;
    const message = authActionErrorMessage(e);
    if (message) return { error: message };
    throw e;
  }
}

export async function registerAction(
  _prev: RegisterFormState | undefined,
  formData: FormData,
) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
  });

  const locale = await getLocale();

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZodIssues(locale, parsed.error.issues) };
  }

  try {
    await registerWithCredentials(parsed.data);
    await signInWithProvider(
      "credentials",
      {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      "/onboarding",
    );
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (e instanceof AppError && e.code === "CONFLICT" && e.field) {
      return { fieldErrors: conflictFieldError(locale, e.field) };
    }
    if (e instanceof AppError && e.code === "CONFLICT") {
      return { error: authMessage(locale, "accountExists") };
    }
    if (e instanceof AuthError) {
      return { error: authMessage(locale, "signInAfterRegisterFailed") };
    }
    const message = authActionErrorMessage(e);
    if (message) return { error: message };
    throw e;
  }
}

export async function loginWithGoogleAction(callbackUrl?: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    redirect("/login?error=Configuration");
  }

  await signIn("google", {
    redirectTo: callbackUrl ?? "/onboarding",
  });
}

export async function loginWithPhoneOtpAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const parsed = otpVerifySchema.safeParse({
    phone: formData.get("phone"),
    code: formData.get("code"),
  });

  if (!parsed.success) {
    const locale = await getLocale();
    const field = parsed.error.issues[0]?.path[0]?.toString();
    return { error: authValidationMessage(locale, field) };
  }

  const locale = await getLocale();
  const callbackUrl = String(formData.get("callbackUrl") || "/dashboard");

  try {
    await signInWithProvider(
      "phone-otp",
      {
        phone: parsed.data.phone,
        code: parsed.data.code,
      },
      callbackUrl,
    );
  } catch (e) {
    if (isRedirectError(e)) throw e;
    const message = authActionErrorMessage(e);
    if (message) {
      return {
        error:
          message === "Invalid email or password"
            ? authValidationMessage(locale, "code")
            : message,
      };
    }
    throw e;
  }
}
