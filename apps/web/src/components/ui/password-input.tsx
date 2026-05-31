"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@zindagi/shared";
import { useTranslations } from "@/i18n/locale-provider";
import { Input } from "./input";

export function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const t = useTranslations();

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-12 text-base", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
      >
        {visible ? (
          <EyeOff className="h-5 w-5" aria-hidden />
        ) : (
          <Eye className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
