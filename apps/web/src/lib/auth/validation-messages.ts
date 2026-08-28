import type { ZodIssue } from "zod";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/en";
import type { AppErrorField } from "@zindagi/shared";

export type AuthFormField = AppErrorField | "dateOfBirth" | "confirmPassword";

export function authValidationMessage(
  locale: Locale,
  field: string | undefined,
): string {
  const v = getDictionary(locale).auth.validation;
  switch (field) {
    case "phone":
      return v.phone;
    case "password":
      return v.password;
    case "email":
      return v.email;
    case "name":
      return v.name;
    case "city":
      return v.city;
    case "dateOfBirth":
      return v.dateOfBirth;
    case "confirmPassword":
      return v.confirmPassword;
    case "code":
      return v.otp;
    default:
      return v.generic;
  }
}

export function fieldErrorsFromZodIssues(
  locale: Locale,
  issues: ZodIssue[],
): Partial<Record<AuthFormField, string>> {
  const errors: Partial<Record<AuthFormField, string>> = {};
  const knownFields = {
    name: 1,
    email: 1,
    phone: 1,
    password: 1,
    city: 1,
    dateOfBirth: 1,
    confirmPassword: 1,
  };
  for (const issue of issues) {
    const field = issue.path[0]?.toString() as AuthFormField | undefined;
    if (field && field in knownFields && !errors[field]) {
      errors[field] = authValidationMessage(locale, field);
    }
  }
  return errors;
}

export function conflictFieldError(
  locale: Locale,
  field: AppErrorField,
): Partial<Record<AuthFormField, string>> {
  const message =
    field === "email"
      ? getDictionary(locale).auth.validation.emailTaken
      : getDictionary(locale).auth.validation.phoneTaken;
  return { [field]: message };
}

export function authMessage(
  locale: Locale,
  key: keyof Pick<
    Dictionary["auth"],
    "accountExists" | "signInAfterRegisterFailed"
  >,
): string {
  return getDictionary(locale).auth[key];
}
