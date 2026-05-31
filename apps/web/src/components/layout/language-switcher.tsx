"use client";

import { cn } from "@zindagi/shared";
import type { Locale } from "@/i18n/config";
import { useLocale, useTranslations } from "@/i18n/locale-provider";

type LanguageSwitcherProps = {
  className?: string;
  /** Compact pill for header; default segmented control */
  variant?: "segmented" | "compact";
  /** Match header account chip height (40px) */
  size?: "default" | "header";
};

export function LanguageSwitcher({
  className,
  variant = "segmented",
  size = "default",
}: LanguageSwitcherProps) {
  const { locale, setLocale, isPending } = useLocale();
  const t = useTranslations();

  const options: { value: Locale; label: string }[] = [
    { value: "en", label: t.common.english },
    { value: "ur", label: t.common.urdu },
  ];
  const ariaLabel = t.common.language;

  if (variant === "compact") {
    const isHeader = size === "header";
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-xl border border-slate-200/80 bg-white/90 font-semibold shadow-sm",
          isHeader ? "h-10 p-1 text-xs" : "rounded-lg p-0.5 text-xs",
          isPending && "opacity-70",
          className,
        )}
        role="group"
        aria-label={ariaLabel}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={isPending}
            onClick={() => setLocale(opt.value)}
            className={cn(
              "inline-flex min-w-[2.5rem] items-center justify-center rounded-lg px-2.5 transition-colors",
              isHeader ? "h-full" : "rounded-md px-2 py-1",
              locale === opt.value
                ? "bg-brand text-white"
                : "text-slate-600 hover:bg-brand-muted hover:text-brand-dark",
            )}
            aria-pressed={locale === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1",
        isPending && "opacity-70",
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={isPending}
          onClick={() => setLocale(opt.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            locale === opt.value
              ? "bg-white text-brand-dark shadow-sm"
              : "text-slate-600 hover:text-brand-dark",
          )}
          aria-pressed={locale === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
