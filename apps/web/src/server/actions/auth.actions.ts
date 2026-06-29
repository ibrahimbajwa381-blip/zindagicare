"use server";

import { CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { auth, signIn } from "@/lib/auth";
import { authActionErrorMessage } from "@/lib/auth/errors";
import { getLocale } from "@/i18n/server";
import { getDictionary } from "@/i18n";
import {
  authMessage,
  authValidationMessage,
  conflictFieldError,
  fieldErrorsFromZodIssues,
  type AuthFormField,
} from "@/lib/auth/validation-messages";

export type RegisterFormState = {
  fieldErrors?: Partial<Record<AuthFormField | "termsAccepted", string>>;
  error?: string;
};
import { registerWithCredentials } from "@/server/services/auth.service";
import { AppError } from "@zindagi/shared";
import { loginSchema, otpVerifySchema, registerSchema, type AccountType } from "@zindagi/validators";
import { isGoogleAuthConfigured } from "@/lib/auth/google";
import { AUTH_ROUTES, resolveLoginRedirectPath } from "@/lib/auth/routes";

async function signInWithProvider(
  provider: "credentials" | "phone-otp",
  fields: Record<string, string>,
  options: { redirectTo: string } | { callbackUrl?: string },
) {
  const result = await signIn(provider, {
    ...fields,
    redirect: false,
  });

  if (typeof result === "string" && result.includes("error=")) {
    throw new CredentialsSignin();
  }

  const session = await auth();
  if (!session?.user) {
    throw new CredentialsSignin();
  }

  const redirectTo =
    "redirectTo" in options
      ? options.redirectTo
      : resolveLoginRedirectPath(session.user, options.callbackUrl);

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
      { callbackUrl },
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
  const locale = await getLocale();

  if (formData.get("termsAccepted") !== "true") {
    return {
      fieldErrors: {
        termsAccepted: getDictionary(locale).legal.registerTermsRequired,
      },
    };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
    accountType: formData.get("accountType") ?? "patient",
    city: formData.get("city") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZodIssues(locale, parsed.error.issues) };
  }

  const accountType = (formData.get("accountType") ?? "patient") as AccountType;

  try {
    await registerWithCredentials(parsed.data);
    redirect(AUTH_ROUTES.login);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (e instanceof AppError && e.code === "CONFLICT" && e.field === "email") {
      if (accountType !== "patient") {
        return {
          fieldErrors: {
            email: getDictionary(locale).auth.emailTakenSignInForStaff,
          },
        };
      }
      return { fieldErrors: conflictFieldError(locale, e.field) };
    }
    if (e instanceof AppError && e.code === "CONFLICT") {
      return { error: authMessage(locale, "accountExists") };
    }
    const message = authActionErrorMessage(e);
    if (message) return { error: message };
    throw e;
  }
}

export async function loginWithGoogleAction(callbackUrl?: string) {
  if (!isGoogleAuthConfigured()) {
    redirect(`${AUTH_ROUTES.login}?error=Configuration`);
  }

  await signIn("google", {
    redirectTo: callbackUrl ?? AUTH_ROUTES.patientDashboard,
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
      { callbackUrl },
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
