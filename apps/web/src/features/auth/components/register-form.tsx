"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { registerAction } from "@/server/actions/auth.actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormField label="Full name" name="name" autoComplete="name" required />
      <FormField label="Email" name="email" type="email" autoComplete="email" required />
      <FormField
        label="Phone (Pakistan)"
        name="phone"
        type="tel"
        placeholder="03XXXXXXXXX"
        autoComplete="tel"
        required
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
      />
      <FieldError message={state?.error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
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
