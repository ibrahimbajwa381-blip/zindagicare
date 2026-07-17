"use client";

import { pakistaniPhoneSchema } from "@zindagi/validators";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import { useLocale, useTranslations } from "@/i18n/locale-provider";

type OnboardingUser = {
  onboardingCompleted?: boolean;
  hasPhone?: boolean;
  roles?: string[];
  doctorVerificationStatus?: string;
  nurseVerificationStatus?: string;
};

type OnboardingFormProps = {
  /** Google (and other phoneless) accounts must add a WhatsApp number here. */
  needsPhone?: boolean;
};

export function OnboardingForm({ needsPhone = false }: OnboardingFormProps) {
  const { push } = useSafeRouter();
  const { update } = useSession();
  const { locale } = useLocale();
  const t = useTranslations();
  const [error, setError] = useState<string>();
  const [phoneError, setPhoneError] = useState<string>();
  const [pending, setPending] = useState(false);

  function validatePhone(value: string) {
    const result = pakistaniPhoneSchema.safeParse(value);
    if (!result.success) {
      setPhoneError(t.auth.validation.phone);
      return null;
    }
    setPhoneError(undefined);
    return result.data;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    setPhoneError(undefined);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      city: form.get("city"),
      locale: form.get("locale") ?? locale,
      dateOfBirth: form.get("dateOfBirth") || undefined,
      gender: form.get("gender") || undefined,
    };

    if (needsPhone) {
      const phone = validatePhone(String(form.get("phone") ?? ""));
      if (!phone) {
        setPending(false);
        return;
      }
      body.phone = phone;
    }

    const res = await fetch("/api/v1/auth/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setPending(false);
      const json = await res.json().catch(() => ({}));
      const field = json?.error?.field as string | undefined;
      const message =
        json?.error?.message ?? "Could not save onboarding. Try again.";
      if (field === "phone" || res.status === 409) {
        setPhoneError(
          json?.error?.code === "CONFLICT"
            ? t.auth.validation.phoneTaken
            : message,
        );
      } else {
        setError(message);
      }
      return;
    }

    const json = (await res.json()) as {
      data?: { user?: OnboardingUser };
    };
    const user = json.data?.user;

    if (user) {
      await update({
        onboardingCompleted: user.onboardingCompleted,
        hasPhone: user.hasPhone ?? true,
        roles: user.roles,
        doctorVerificationStatus: user.doctorVerificationStatus,
        nurseVerificationStatus: user.nurseVerificationStatus,
      });
    }

    setPending(false);
    push(AUTH_ROUTES.patientDashboard);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {needsPhone ? (
        <div>
          <Label htmlFor="phone">{t.onboarding.whatsappNumber}</Label>
          <p className="mb-1.5 text-sm text-slate-500">{t.onboarding.whatsappHint}</p>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder={t.auth.phonePlaceholder}
            className="h-12 text-base"
            maxLength={15}
            required
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value) validatePhone(value);
              else setPhoneError(undefined);
            }}
            onChange={() => {
              if (phoneError) setPhoneError(undefined);
            }}
          />
          <FieldError message={phoneError} />
        </div>
      ) : null}

      <div>
        <Label htmlFor="city">{t.onboarding.city}</Label>
        <Input id="city" name="city" defaultValue="Lahore" required />
      </div>

      <div>
        <Label htmlFor="locale">{t.onboarding.language}</Label>
        <select
          id="locale"
          name="locale"
          className="flex h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
          defaultValue={locale}
        >
          <option value="en">{t.auth.english}</option>
          <option value="ur">{t.auth.urdu}</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="dateOfBirth">Date of birth (optional)</Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" />
        </div>
        <div>
          <Label htmlFor="gender">Gender (optional)</Label>
          <select
            id="gender"
            name="gender"
            className="flex h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending} loading={pending}>
        {pending ? t.onboarding.submitting : t.onboarding.submit}
      </Button>
    </form>
  );
}
