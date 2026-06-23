"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Lock,
  Sparkles,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { siteConfig } from "@/config/site";
import { useTranslations } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/messages";
import { surfaceInset } from "@/lib/ui/surfaces";
import type { MedicalIntakeDto } from "../types";

type Props = {
  appointmentId: string;
};

export function IntakeForm({ appointmentId }: Props) {
  const t = useTranslations();
  const copy = t.intake;

  const [intake, setIntake] = useState<MedicalIntakeDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/v1/intake/${appointmentId}`);
    const json = await res.json();
    if (json.success && json.data) {
      const data = json.data as MedicalIntakeDto;
      setIntake(data);
      setAnswers(
        Object.fromEntries(
          data.questions.map((q) => [q.key, q.answer ?? ""]),
        ),
      );
    } else {
      setNotFound(true);
    }
    setLoading(false);
  }, [appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalQuestions = intake?.questions.length ?? 0;
  const answeredCount = useMemo(
    () =>
      Object.values(answers).filter((value) => value.trim().length > 0).length,
    [answers],
  );
  const progressPercent =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const handleSubmit = async () => {
    if (!intake) return;
    setSubmitting(true);
    setError(null);

    const payload = {
      answers: intake.questions.map((q) => ({
        key: q.key,
        answer: (answers[q.key] ?? "").trim(),
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
    } else {
      setError(json.error?.message ?? copy.submitError);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <Card className="overflow-hidden border-white/70 shadow-premium">
        <CardContent className="py-16">
          <LoadingScreen message={copy.loading} />
        </CardContent>
      </Card>
    );
  }

  if (notFound || !intake) {
    return (
      <Card className="overflow-hidden border-white/70 shadow-premium">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:py-16">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <AlertCircle className="h-8 w-8" aria-hidden />
          </span>
          <h2 className="mt-5 font-display text-lg font-semibold text-foreground">
            {copy.notFoundTitle}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
            {copy.notFound}
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href={siteConfig.links.dashboard}>{copy.backToDashboard}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (intake.status === "completed") {
    return (
      <Card className="overflow-hidden border-emerald-200/60 bg-gradient-to-b from-emerald-50/80 via-white to-white shadow-premium">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:py-16">
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
            <CheckCircle2 className="h-10 w-10" aria-hidden />
          </span>
          <h2 className="mt-6 font-display text-xl font-semibold text-foreground sm:text-2xl">
            {copy.completedTitle}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
            {copy.completedDescription}
          </p>
          <Button asChild className="mt-8 min-w-[12rem]" size="lg">
            <Link href={siteConfig.links.dashboard}>{copy.backToDashboard}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-brand-light/35 bg-gradient-to-br from-brand-muted/70 via-white/90 to-accent-muted/40 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-display text-base font-semibold text-slate-900 sm:text-lg">
                {formatMessage(copy.questionCount, { count: totalQuestions })}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                <Lock className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                {copy.formSubtitle}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-light/40 bg-white/80 px-3 py-1.5 text-xs font-medium text-brand-dark">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {copy.optionalHintShort}
          </span>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium">
            <span className="text-slate-600">
              {formatMessage(copy.progressAnswered, {
                answered: answeredCount,
                total: totalQuestions,
              })}
            </span>
            <span className="tabular-nums text-brand-dark">{progressPercent}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-brand-light/25"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={formatMessage(copy.progressAnswered, {
              answered: answeredCount,
              total: totalQuestions,
            })}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-[width] duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-white/70 p-0 shadow-premium">
        <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-6">
          {intake.questions.map((question, index) => {
            const hasAnswer = (answers[question.key] ?? "").trim().length > 0;

            return (
              <label
                key={question.key}
                className={cn(
                  surfaceInset,
                  "block p-4 transition-colors sm:p-5",
                  hasAnswer
                    ? "border-brand-light/50 bg-brand-muted/30"
                    : "hover:border-brand-light/40 hover:bg-white/90",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums",
                      hasAnswer
                        ? "bg-brand text-white"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {hasAnswer ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug text-slate-900 sm:text-base">
                      {question.text}
                    </span>
                    <textarea
                      value={answers[question.key] ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [question.key]: e.target.value,
                        }))
                      }
                      rows={3}
                      maxLength={2000}
                      placeholder={copy.answerPlaceholder}
                      className={cn(
                        "mt-3 w-full resize-y rounded-xl border border-slate-200/80 bg-white/95 px-3.5 py-2.5 text-sm text-foreground shadow-sm",
                        "placeholder:text-slate-400 focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25",
                      )}
                    />
                  </div>
                </div>
              </label>
            );
          })}
        </CardContent>

        <div className="sticky bottom-3 z-10 mx-4 mb-4 rounded-2xl border border-white/70 bg-white/95 p-4 shadow-premium backdrop-blur-md sm:bottom-4 sm:mx-6 sm:mb-6 sm:p-5">
          <p className="mb-3 text-xs leading-relaxed text-slate-500 sm:text-sm">
            {copy.optionalHint}
          </p>
          {error && (
            <p className="mb-3 rounded-xl border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="hidden text-xs text-slate-500 sm:block">
              {formatMessage(copy.progressAnswered, {
                answered: answeredCount,
                total: totalQuestions,
              })}
            </p>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              loading={submitting}
              size="lg"
              className="w-full sm:ml-auto sm:w-auto sm:min-w-[12rem]"
            >
              {submitting ? copy.submitting : copy.submit}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
