"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { siteConfig } from "@/config/site";
import { useTranslations } from "@/i18n/locale-provider";
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
    return <LoadingScreen message={copy.loading} />;
  }

  if (notFound || !intake) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-slate-600">{copy.notFound}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={siteConfig.links.dashboard}>{copy.backToDashboard}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (intake.status === "completed") {
    return (
      <Card className="border-emerald-200/70 bg-emerald-50/40">
        <CardContent className="py-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold text-foreground">
            {copy.completedTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{copy.completedDescription}</p>
          <Button asChild className="mt-5">
            <Link href={siteConfig.links.dashboard}>{copy.backToDashboard}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-premium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4 text-brand" aria-hidden />
          {copy.formTitle}
        </CardTitle>
        <p className="text-sm text-slate-500">{copy.formSubtitle}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-slate-500">{copy.optionalHint}</p>

        {intake.questions.map((question, index) => (
          <label key={question.key} className="block">
            <span className="text-sm font-medium text-slate-800">
              {index + 1}. {question.text}
            </span>
            <textarea
              value={answers[question.key] ?? ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [question.key]: e.target.value }))
              }
              rows={3}
              maxLength={2000}
              placeholder={copy.answerPlaceholder}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm shadow-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25"
            />
          </label>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleSubmit} disabled={submitting} loading={submitting} className="w-full sm:w-auto">
          {submitting ? copy.submitting : copy.submit}
        </Button>
      </CardContent>
    </Card>
  );
}
