"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  loginWithCredentialsAction,
  loginWithGoogleAction,
} from "@/server/actions/auth.actions";

type LoginFormProps = {
  callbackUrl?: string;
  initialError?: string;
  googleEnabled?: boolean;
};

export function LoginForm({
  callbackUrl,
  initialError,
  googleEnabled = false,
}: LoginFormProps) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(loginWithCredentialsAction, undefined);
  const errorMessage = state?.error ?? initialError;
  const phoneLoginHref = callbackUrl
    ? `/login/phone?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login/phone";

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/dashboard"} />
        <FormField label={t.auth.email} name="email" type="email" autoComplete="email" required />
        <div>
          <Label htmlFor="password" className="text-base font-semibold">
            {t.auth.password}
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            className="mt-1.5 h-12"
            required
          />
        </div>
        <FieldError message={errorMessage} />
        <Button type="submit" size="lg" className="w-full" disabled={pending} loading={pending}>
          {pending ? t.auth.signingIn : t.auth.signIn}
        </Button>
      </form>

      {googleEnabled ? (
        <>
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase text-slate-400">
              <span className="bg-white/90 px-2 backdrop-blur-sm">{t.auth.or}</span>
            </div>
          </div>

          <form
            action={async () => {
              await loginWithGoogleAction(callbackUrl ?? "/dashboard");
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              {t.auth.continueGoogle}
            </Button>
          </form>
        </>
      ) : null}

      <p className="text-center text-sm text-slate-600">
        {t.auth.preferPhone}{" "}
        <Link href={phoneLoginHref} className="font-medium text-brand">
          {t.auth.signInOtp}
        </Link>
      </p>
    </div>
  );
}

function FormField(
  props: React.ComponentProps<typeof Input> & { label: string },
) {
  const { label, ...inputProps } = props;
  return (
    <div>
      <Label htmlFor={inputProps.name}>{label}</Label>
      <Input id={inputProps.name} {...inputProps} />
    </div>
  );
}
