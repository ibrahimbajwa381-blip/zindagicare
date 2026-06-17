"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { otpRequestSchema } from "@zindagi/validators";
import { formatMessage } from "@/i18n/messages";
import { useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { loginWithPhoneOtpAction } from "@/server/actions/auth.actions";

export function PhoneOtpForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [otpError, setOtpError] = useState<string>();
  const [state, action, pending] = useActionState(loginWithPhoneOtpAction, undefined);
  const loginHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";

  async function requestOtp() {
    setOtpError(undefined);

    const parsed = otpRequestSchema.safeParse({ phone });
    if (!parsed.success) {
      setOtpError(t.auth.validation.phone);
      return;
    }

    const res = await fetch("/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: parsed.data.phone }),
    });
    const json = (await res.json()) as {
      error?: { message?: string };
    };

    if (!res.ok) {
      setOtpError(json.error?.message ?? t.auth.validation.phone);
      return;
    }

    setPhone(parsed.data.phone);
    setStep("code");
  }

  if (step === "phone") {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="phone" className="text-base font-semibold">
            {t.auth.mobileNumber}
          </Label>
          <p className="mb-1.5 text-sm text-slate-500">{t.auth.phoneHint}</p>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder={t.auth.phonePlaceholder}
            className="h-12 text-base"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={15}
            required
          />
        </div>
        <FieldError message={otpError} />
        <Button type="button" className="w-full" onClick={requestOtp}>
          {t.auth.sendOtp}
        </Button>
        <p className="text-center text-sm text-slate-600">
          <Link href={loginHref} className="font-medium text-brand">
            {t.auth.backToEmailLogin}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/dashboard"} />
      <div>
        <Label htmlFor="code">{t.auth.sixDigitCode}</Label>
        <Input id="code" name="code" inputMode="numeric" maxLength={6} required />
        <p className="mt-1 text-xs text-slate-500">
          {formatMessage(t.auth.sentTo, { phone })}
        </p>
      </div>
      <FieldError message={state?.error} />
      <Button type="submit" className="w-full" disabled={pending} loading={pending}>
        {pending ? t.auth.verifying : t.auth.verifySignIn}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("phone")}>
        {t.auth.changeNumber}
      </Button>
    </form>
  );
}
