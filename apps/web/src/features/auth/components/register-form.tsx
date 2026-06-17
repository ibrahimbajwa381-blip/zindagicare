"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { pakistaniPhoneSchema, type AccountType } from "@zindagi/validators";
import { siteConfig } from "@/config/site";
import { useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { registerAction, type RegisterFormState } from "@/server/actions/auth.actions";

type RegisterFormProps = {
  accountType?: AccountType;
};

export function RegisterForm({ accountType = "patient" }: RegisterFormProps) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<RegisterFormState | undefined, FormData>(
    registerAction,
    undefined,
  );
  const [clientPhoneError, setClientPhoneError] = useState<string>();
  const [termsError, setTermsError] = useState<string>();

  const phoneError = state?.fieldErrors?.phone ?? clientPhoneError;
  const termsFieldError = state?.fieldErrors?.termsAccepted ?? termsError;
  const showCity = accountType !== "patient";

  function validatePhoneValue(value: string) {
    const result = pakistaniPhoneSchema.safeParse(value);
    if (!result.success) {
      setClientPhoneError(t.auth.validation.phone);
      return false;
    }
    setClientPhoneError(undefined);
    return true;
  }

  return (
    <form
      action={action}
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        const form = e.currentTarget;
        const phone = (form.elements.namedItem("phone") as HTMLInputElement)?.value ?? "";
        const termsAccepted = (form.elements.namedItem("termsAccepted") as HTMLInputElement)
          ?.checked;
        let blocked = false;
        if (!validatePhoneValue(phone)) {
          blocked = true;
        }
        if (!termsAccepted) {
          setTermsError(t.legal.registerTermsRequired);
          blocked = true;
        } else {
          setTermsError(undefined);
        }
        if (blocked) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="accountType" value={accountType} />
      <FormField
        label={t.auth.fullName}
        hint={t.auth.fullNameHint}
        name="name"
        autoComplete="name"
        placeholder="Ali Khan"
        error={state?.fieldErrors?.name}
        required
      />
      <FormField
        label={t.auth.email}
        name="email"
        type="email"
        autoComplete="email"
        placeholder="name@gmail.com"
        error={state?.fieldErrors?.email}
        required
      />
      <FormField
        label={t.auth.mobileNumber}
        hint={t.auth.phoneHint}
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder={t.auth.phonePlaceholder}
        error={phoneError}
        invalid={!!phoneError}
        onBlur={(e) => {
          const value = e.target.value.trim();
          if (value) validatePhoneValue(value);
          else setClientPhoneError(undefined);
        }}
        onChange={() => {
          if (clientPhoneError) setClientPhoneError(undefined);
        }}
        required
      />
      {showCity ? (
        <FormField
          label={t.onboarding.city}
          name="city"
          defaultValue="Lahore"
          error={state?.fieldErrors?.city}
          required
        />
      ) : null}
      <div>
        <Label htmlFor="password" className="text-base font-semibold text-slate-800">
          {t.auth.password}
        </Label>
        <p className="mb-1.5 text-sm text-slate-500">{t.auth.passwordHint}</p>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
        <FieldError message={state?.fieldErrors?.password} />
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
          <input
            type="checkbox"
            name="termsAccepted"
            value="true"
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand"
            aria-invalid={!!termsFieldError}
            onChange={() => {
              if (termsError) setTermsError(undefined);
            }}
            required
          />
          <span>
            {t.legal.registerAcceptanceBefore}{" "}
            <Link
              href={siteConfig.links.terms}
              className="font-semibold text-brand hover:text-brand-dark hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.legal.pages.terms}
            </Link>{" "}
            {t.legal.registerAcceptanceAnd}{" "}
            <Link
              href={siteConfig.links.privacy}
              className="font-semibold text-brand hover:text-brand-dark hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.legal.pages.privacy}
            </Link>
            {t.legal.registerAcceptanceAfter ? ` ${t.legal.registerAcceptanceAfter}` : null}
          </span>
        </label>
        <FieldError message={termsFieldError} />
      </div>
      <FieldError message={state?.error} />
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending} loading={pending}>
        {pending ? t.auth.creatingAccount : t.auth.createAccount}
      </Button>
    </form>
  );
}

function FormField({
  label,
  hint,
  error,
  invalid,
  ...inputProps
}: React.ComponentProps<typeof Input> & {
  label: string;
  hint?: string;
  error?: string;
  invalid?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={inputProps.name} className="text-base font-semibold text-slate-800">
        {label}
      </Label>
      {hint ? <p className="mb-1.5 text-sm text-slate-500">{hint}</p> : null}
      <Input
        id={inputProps.name}
        className="h-12 text-base"
        aria-invalid={invalid || !!error}
        {...inputProps}
      />
      <FieldError message={error} />
    </div>
  );
}
