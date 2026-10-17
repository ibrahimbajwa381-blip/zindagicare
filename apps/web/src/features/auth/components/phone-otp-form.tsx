"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { otpRequestSchema } from "@zindagi/validators";
import { formatMessage } from "@/i18n/messages";
import { useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPasswordWithOtpAction } from "@/server/actions/auth.actions";

export function PhoneOtpForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [otpError, setOtpError] = useState<string>();
  const [otpNotice, setOtpNotice] = useState<string>();
  const [sendingOtp, setSendingOtp] = useState(false);
  const [state, action, pending] = useActionState(resetPasswordWithOtpAction, undefined);
  const loginHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";

  async function requestOtp() {
    setOtpError(undefined);
    setOtpNotice(undefined);
    setSendingOtp(true);

    try {
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
        error?: { code?: string; message?: string };
      };

      if (!res.ok) {
        if (res.status === 404) {
          setOtpError(t.auth.phoneNotRegistered);
          return;
        }
        if (res.status === 429 || json.error?.code === "RATE_LIMITED") {
          setOtpError(t.auth.otpRateLimited);
          return;
        }
        setOtpError(json.error?.message ?? t.auth.validation.phone);
        return;
      }

      setPhone(parsed.data.phone);
      const isResend = step === "code";
      setStep("code");
      if (isResend) {
        setOtpNotice(t.auth.otpResent);
      }
    } finally {
      setSendingOtp(false);
    }
  }

  if (step === "phone") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{t.auth.phoneLoginHint}</p>
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
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={requestOtp}
          disabled={sendingOtp}
          loading={sendingOtp}
        >
          {sendingOtp ? t.auth.sendingOtp : t.auth.sendOtp}
        </Button>
        <p className="text-center text-sm text-slate-600">
          <Link href={loginHref} className="font-medium text-brand">
            {t.auth.backToSignIn}
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
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          maxLength={6}
          className="h-12 text-base tracking-widest"
          autoComplete="one-time-code"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          {formatMessage(t.auth.sentTo, { phone })}
        </p>
      </div>
      <div>
        <Label htmlFor="password">{t.auth.newPassword}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          className="mt-1.5 h-12"
          minLength={6}
          required
        />
      </div>
      <div>
        <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          className="mt-1.5 h-12"
          minLength={6}
          required
        />
      </div>
      {otpNotice ? (
        <p className="text-sm text-emerald-700" role="status">
          {otpNotice}
        </p>
      ) : null}
      <FieldError message={otpError ?? state?.error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending} loading={pending}>
        {pending ? t.auth.verifying : t.auth.resetPasswordSubmit}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={requestOtp}
        disabled={sendingOtp}
        loading={sendingOtp}
      >
        {sendingOtp ? t.auth.sendingOtp : t.auth.resendOtp}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("phone")}>
        {t.auth.changeNumber}
      </Button>
    </form>
  );
}
