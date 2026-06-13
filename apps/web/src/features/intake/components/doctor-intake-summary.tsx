"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n/locale-provider";
import type { MedicalIntakeDto } from "../types";

type Props = {
  appointmentId: string;
  className?: string;
  /** Render the Q&A expanded by default. */
  defaultOpen?: boolean;
};

/**
 * Structured pre-consult medical history panel for doctors.
 * Renders nothing while loading or when no intake exists for the appointment.
 */
export function DoctorIntakeSummary({
  appointmentId,
  className,
  defaultOpen = false,
}: Props) {
  const t = useTranslations();
  const copy = t.intake;

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
  const answered = intake.questions.filter((q) => !!q.answer);

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white/90",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
          <ClipboardList className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span className="truncate">{copy.doctorSummaryTitle}</span>
          <Badge
            variant={completed ? "secondary" : "outline"}
            className={cn(
              "text-[11px]",
              completed
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-300 bg-amber-50 text-amber-700",
            )}
          >
            {completed ? copy.statusCompleted : copy.statusPending}
          </Badge>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3.5 py-3">
          {answered.length === 0 ? (
            <p className="text-sm text-slate-500">{copy.doctorSummaryPending}</p>
          ) : (
            <dl className="space-y-3">
              {intake.questions.map((question, index) => (
                <div key={question.key}>
                  <dt className="text-xs font-semibold text-slate-500">
                    {index + 1}. {question.text}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">
                    {question.answer || (
                      <span className="italic text-slate-400">
                        {copy.doctorSummaryEmpty}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
