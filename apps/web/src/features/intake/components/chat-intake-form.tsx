"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useTranslations } from "@/i18n/locale-provider";
import type { MedicalIntakeDto } from "../types";

type ChatIntakeFormProps = {
  appointmentId: string;
  onCompleted?: () => void;
};

export function ChatIntakeForm({ appointmentId, onCompleted }: ChatIntakeFormProps) {
  const t = useTranslations();
  const copy = t.intake.chatForm;

  const [intake, setIntake] = useState<MedicalIntakeDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/intake/${appointmentId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const data = json.data as MedicalIntakeDto;
        setIntake(data);
        setAnswers(
          Object.fromEntries(
            data.questions.map((question) => [question.key, question.answer ?? ""]),
          ),
        );
      } else {
        setIntake(null);
      }
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async () => {
    if (!intake) return;
    setSubmitting(true);
    setError(null);

    const payload = {
      answers: intake.questions.map((question) => ({
        key: question.key,
        answer: (answers[question.key] ?? "").trim(),
      })),
    };

    const res = await fetch(`/api/v1/intake/${appointmentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (json.success && json.data) {
      setIntake(json.data as MedicalIntakeDto);
      onCompleted?.();
    } else {
      setError(json.error?.message ?? copy.submitError);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="border-b border-slate-200 bg-white/95 px-3 py-4 sm:px-4">
        <LoadingScreen message={copy.loading} size="sm" />
      </div>
    );
  }

  if (!intake || intake.status === "completed") {
    return null;
  }

  if (dismissed) {
    return (
      <div className="shrink-0 border-b border-slate-200 bg-white/95 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="text-xs font-medium text-brand hover:text-brand-dark"
        >
          {copy.reopen}
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-brand-light/30 bg-white/95 px-3 py-3 sm:px-4">
      <div className="flex max-h-[min(52vh,26rem)] flex-col overflow-hidden rounded-2xl border border-brand-light/35 bg-brand-muted/20 shadow-sm">
        <div className="shrink-0 border-b border-brand-light/20 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ClipboardList className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                {copy.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">{copy.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
              aria-label={copy.skip}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">{copy.optionalHint}</p>
        </div>

        <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            {intake.questions.map((question, index) => (
              <label key={question.key} className="block">
                <span className="text-xs font-medium text-slate-800">
                  {index + 1}. {question.text}
                </span>
                <textarea
                  value={answers[question.key] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [question.key]: e.target.value }))
                  }
                  rows={2}
                  maxLength={2000}
                  placeholder={copy.answerPlaceholder}
                  className={cn(
                    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm",
                    "outline-none focus:border-brand-light focus:ring-2 focus:ring-brand-muted",
                  )}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-brand-light/25 bg-white/90 px-4 py-3">
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              loading={submitting}
            >
              {submitting ? copy.submitting : copy.submit}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDismissed(true)}
              disabled={submitting}
            >
              {copy.skip}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
