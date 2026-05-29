"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import {
  loginWithCredentialsAction,
  loginWithGoogleAction,
} from "@/server/actions/auth.actions";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState(loginWithCredentialsAction, undefined);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/dashboard"} />
        <FormField label="Email" name="email" type="email" autoComplete="email" required />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <FieldError message={state?.error} />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase text-slate-400">
          <span className="bg-white/90 px-2 backdrop-blur-sm">or</span>
        </div>
      </div>

      <form
        action={async () => {
          await loginWithGoogleAction(callbackUrl ?? "/dashboard");
        }}
      >
        <Button type="submit" variant="outline" className="w-full">
          Continue with Google
        </Button>
      </form>

      <p className="text-center text-sm text-slate-600">
        Prefer phone?{" "}
        <Link href="/login/phone" className="font-medium text-brand">
          Sign in with OTP
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
