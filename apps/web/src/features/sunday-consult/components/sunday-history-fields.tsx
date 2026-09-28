"use client";

import { cn, getPaidOnlineIntakeQuestions } from "@zindagi/shared";
import { useOptionalLocale, useTranslations } from "@/i18n/locale-provider";
import { getQuestionMeta } from "@/features/intake/lib/question-meta";

type Props = {
  answers: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  /** Highlight unanswered questions after a failed submit. */
  showErrors?: boolean;
};

/**
 * Medical history for the Sunday request — the same questions the paid
 * online consult asks. Every question is required.
 */
export function SundayHistoryFields({ answers, onChange, disabled, showErrors }: Props) {
  const locale = useOptionalLocale();
  const t = useTranslations();
  const copy = t.sunday.history;
  const questions = getPaidOnlineIntakeQuestions(locale === "ur" ? "ur" : "en");

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium text-slate-700">{copy.title}</legend>
      <p className="-mt-2 text-xs text-slate-500">{copy.hint}</p>
      {questions.map((question, index) => {
        const meta = getQuestionMeta(question.key);
        const Icon = meta.icon;
        const id = `sunday-history-${question.key}`;
        const missing = showErrors && !(answers[question.key] ?? "").trim();
        return (
          <div key={question.key}>
            <label htmlFor={id} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white",
                  meta.iconBg,
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className={cn("block text-xs font-semibold", meta.accent)}>
                  {index + 1}. {t.intake.wizard.categories[meta.categoryKey]}
                </span>
                <span className="block text-sm text-slate-800">{question.text}</span>
              </span>
            </label>
            <textarea
              id={id}
              required
              rows={2}
              maxLength={2000}
              value={answers[question.key] ?? ""}
              onChange={(e) => onChange(question.key, e.target.value)}
              placeholder={t.intake.answerPlaceholder}
              disabled={disabled}
              aria-invalid={missing || undefined}
              className={cn(
                "mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none ring-brand/30 placeholder:text-slate-400 focus:ring-2",
                missing ? "border-red-300" : "border-slate-200",
              )}
            />
          </div>
        );
      })}
    </fieldset>
  );
}
