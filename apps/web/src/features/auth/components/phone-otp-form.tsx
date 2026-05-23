"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { loginWithPhoneOtpAction } from "@/server/actions/auth.actions";

export function PhoneOtpForm({ callbackUrl }: { callbackUrl?: string }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [otpError, setOtpError] = useState<string>();
  const [state, action, pending] = useActionState(loginWithPhoneOtpAction, undefined);

  async function requestOtp() {
    setOtpError(undefined);
    const res = await fetch("/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      setOtpError("Could not send OTP. Check your number.");
      return;
    }
    setStep("code");
  }

  if (step === "phone") {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="03XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <FieldError message={otpError} />
        <Button type="button" className="w-full" onClick={requestOtp}>
          Send OTP
        </Button>
        <p className="text-center text-sm text-slate-600">
          <Link href="/login" className="font-medium text-brand">
            Back to email login
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
        <Label htmlFor="code">6-digit code</Label>
        <Input id="code" name="code" inputMode="numeric" maxLength={6} required />
        <p className="mt-1 text-xs text-slate-500">Sent to {phone}</p>
      </div>
      <FieldError message={state?.error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Verifying…" : "Verify & sign in"}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("phone")}>
        Change number
      </Button>
    </form>
  );
}
