"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/messages";
import { getQuestionMeta } from "../lib/question-meta";
import type { MedicalIntakeDto } from "../types";

type Props = {
  appointmentId: string;
  className?: string;
  /** Render the Q&A expanded by default. */
  defaultOpen?: boolean;
  /** Single-line header and a height-capped body, for the chat screen. */
  compact?: boolean;
};

/**
 * Structured pre-consult medical history panel for doctors.
 * Renders nothing while loading or when no intake exists for the appointment.
 */
export function DoctorIntakeSummary({
  appointmentId,
  className,
  defaultOpen = false,
  compact = false,
}: Props) {
  const t = useTranslations();
  const copy = t.intake;
  const wizard = copy.wizard;

  const [intake, setIntake] = useState<MedicalIntakeDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/doctor/intake/${appointmentId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setIntake(json.success ? ((json.data as MedicalIntakeDto) ?? null) : null);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  if (!loaded || !intake) return null;

  const completed = intake.status === "completed";
  const answered = intake.questions.filter((q) => !!q.answer?.trim());

  return (
    <div
      className={cn(
        "overflow-hidden border shadow-sm",
        compact ? "rounded-xl" : "rounded-2xl",
        completed
          ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-white"
          : "border-slate-200/80 bg-white/90",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between text-left",
          compact ? "gap-2 px-3 py-1.5" : "gap-3 px-4 py-3.5 sm:px-5",
        )}
      >
        <span className={cn("flex min-w-0 items-center", compact ? "gap-2" : "gap-3")}>
          <span
            className={cn(
              "flex shrink-0 items-center justify-center shadow-sm",
              compact ? "h-7 w-7 rounded-lg" : "h-10 w-10 rounded-xl",
              completed
                ? "bg-emerald-500 text-white"
                : "bg-brand-muted text-brand",
            )}
          >
            {completed ? (
              <CheckCircle2 className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
            ) : (
              <ClipboardList className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
            )}
          </span>
          <span className="min-w-0">
            <span className={cn("flex items-center gap-2", !compact && "flex-wrap")}>
              <span
                className={cn(
                  "font-semibold text-slate-900",
                  compact ? "truncate text-xs sm:text-sm" : "text-sm",
                )}
              >
                {copy.doctorSummaryTitle}
              </span>
              <Badge
                variant={completed ? "secondary" : "outline"}
                className={cn(
                  "shrink-0",
                  compact ? "px-1.5 py-0 text-[10px]" : "text-[11px]",
                  completed
                    ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-700",
                )}
              >
                {completed ? copy.doctorSummaryReady : copy.statusPending}
              </Badge>
            </span>
            {compact ? null : completed && answered.length > 0 ? (
              <span className="mt-0.5 block text-xs text-emerald-700">
                {formatMessage(copy.doctorSummaryAnswers, { count: answered.length })}
                <span className="text-slate-500"> · {copy.doctorSummaryPreview}</span>
              </span>
            ) : (
              <span className="mt-0.5 block text-xs text-slate-500">
                {copy.doctorSummaryPending}
              </span>
            )}
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
      </button>

      {!compact && !open && completed && answered.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-emerald-100/80 px-4 py-3 sm:px-5">
          {answered.map((question) => {
            const meta = getQuestionMeta(question.key);
            const Icon = meta.icon;
            const label = wizard.categories[meta.categoryKey];

            return (
              <span
                key={question.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-800"
              >
                <Icon className="h-3 w-3" aria-hidden />
                {label}
                <Check className="h-3 w-3 text-emerald-500" aria-hidden />
              </span>
            );
          })}
        </div>
      )}

      {open && (
        <div
          className={cn(
            "border-t border-slate-100",
            compact
              ? "max-h-[35svh] overflow-y-auto overscroll-contain px-3 py-3"
              : "px-4 py-4 sm:px-5",
          )}
        >
          {answered.length === 0 ? (
            <p className="text-sm text-slate-500">{copy.doctorSummaryPending}</p>
          ) : (
            <dl className="space-y-3">
              {intake.questions.map((question) => {
                const meta = getQuestionMeta(question.key);
                const Icon = meta.icon;
                const label = wizard.categories[meta.categoryKey];
                const hasAnswer = !!question.answer?.trim();

                return (
                  <div
                    key={question.key}
                    className={cn(
                      "rounded-xl border px-3.5 py-3",
                      hasAnswer
                        ? "border-emerald-100 bg-emerald-50/40"
                        : "border-slate-100 bg-slate-50/50",
                    )}
                  >
                    <dt className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md text-white",
                          hasAnswer ? meta.iconBg : "bg-slate-300",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      {label}
                    </dt>
                    <dd className="mt-2 whitespace-pre-wrap pl-8 text-sm text-slate-800">
                      {hasAnswer ? (
                        question.answer
                      ) : (
                        <span className="italic text-slate-400">
                          {copy.doctorSummaryEmpty}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
