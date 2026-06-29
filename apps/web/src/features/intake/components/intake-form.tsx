"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { siteConfig } from "@/config/site";
import { useTranslations } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/messages";
import { getQuestionMeta } from "../lib/question-meta";
import { IntakeWizardPanel } from "./intake-wizard-panel";
import type { MedicalIntakeDto } from "../types";

type Props = {
  appointmentId: string;
};

function IntakeFlowStrip({
  labels,
  activeStep,
}: {
  labels: { patient: string; intake: string; doctor: string; consult: string };
  activeStep: "intake" | "doctor";
}) {
  const steps = [
    { key: "patient", label: labels.patient, icon: User },
    { key: "intake", label: labels.intake, icon: Sparkles },
    { key: "doctor", label: labels.doctor, icon: CheckCircle2 },
    { key: "consult", label: labels.consult, icon: ChevronRight },
  ] as const;

  return (
    <div className="flex items-center justify-between gap-1 sm:gap-2">
      {steps.map((step, index) => {
        const isActive =
          (step.key === "intake" && activeStep === "intake") ||
          (step.key === "doctor" && activeStep === "doctor");
        const isPast =
          (activeStep === "doctor" && (step.key === "patient" || step.key === "intake")) ||
          step.key === "patient";
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs transition-all sm:h-10 sm:w-10",
                  isActive
                    ? "border-brand bg-brand text-white shadow-md shadow-brand/25"
                    : isPast
                      ? "border-emerald-400 bg-emerald-50 text-emerald-600"
                      : "border-slate-200 bg-white text-slate-400",
                )}
              >
                {isPast && !isActive ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden />
                )}
              </span>
              <span
                className={cn(
                  "hidden text-center text-[10px] font-semibold leading-tight sm:block sm:text-[11px]",
                  isActive ? "text-brand-dark" : isPast ? "text-emerald-700" : "text-slate-400",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                aria-hidden
                className={cn(
                  "mb-4 h-0.5 w-full max-w-4 rounded-full sm:mb-6 sm:max-w-8",
                  isPast ? "bg-emerald-300" : "bg-slate-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function IntakeForm({ appointmentId }: Props) {
  const t = useTranslations();
  const copy = t.intake;
  const wizard = copy.wizard;

  const [intake, setIntake] = useState<MedicalIntakeDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
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
        Object.fromEntries(data.questions.map((q) => [q.key, q.answer ?? ""])),
      );
      const firstUnanswered = data.questions.findIndex(
        (q) => !(q.answer ?? "").trim(),
      );
      setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
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
      const data = json.data as { intake?: MedicalIntakeDto } | MedicalIntakeDto;
      setIntake("intake" in data && data.intake ? data.intake : (data as MedicalIntakeDto));
    } else {
      setError(json.error?.message ?? copy.submitError);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <Card className="w-full min-w-0 overflow-hidden border-white/70 shadow-premium-lg">
        <CardContent className="py-12 sm:py-20">
          <LoadingScreen message={copy.loading} />
        </CardContent>
      </Card>
    );
  }

  if (notFound || !intake) {
    return (
      <Card className="w-full min-w-0 overflow-hidden border-white/70 shadow-premium">
        <CardContent className="flex flex-col items-center px-4 py-10 text-center sm:px-6 sm:py-16">
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
    const sharedQuestions = intake.questions.filter((q) => (q.answer ?? "").trim());

    return (
      <div className="w-full min-w-0 space-y-4 sm:space-y-5">
        <Card className="w-full min-w-0 overflow-hidden border-emerald-200/60 bg-gradient-to-b from-emerald-50/90 via-white to-white shadow-premium-lg">
          <CardContent className="px-4 py-8 text-center sm:px-6 sm:py-14">
            <IntakeFlowStrip
              labels={{
                patient: wizard.flowPatient,
                intake: wizard.flowIntake,
                doctor: wizard.flowDoctor,
                consult: wizard.flowConsult,
              }}
              activeStep="doctor"
            />

            <span className="relative mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-4 ring-emerald-50 sm:mt-8 sm:h-20 sm:w-20 sm:ring-8">
              <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden />
            </span>
            <h2 className="mt-5 font-display text-xl font-semibold text-foreground sm:mt-6 sm:text-2xl md:text-3xl">
              {copy.completedTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
              {copy.completedDescription}
            </p>
          </CardContent>
        </Card>

        {sharedQuestions.length > 0 && (
          <Card className="w-full min-w-0 overflow-hidden border-white/70 shadow-premium">
            <CardContent className="p-4 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-dark">
                {wizard.completedChecklistTitle}
              </p>
              <ul className="mt-4 space-y-2.5">
                {sharedQuestions.map((question) => {
                  const meta = getQuestionMeta(question.key);
                  const Icon = meta.icon;
                  const label = wizard.categories[meta.categoryKey];

                  return (
                    <li
                      key={question.key}
                      className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3.5 py-3"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
                          meta.iconBg,
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-emerald-800">{label}</p>
                        <p className="mt-0.5 break-words text-sm text-slate-700 sm:line-clamp-2">
                          {question.answer}
                        </p>
                      </div>
                      <CheckCircle2
                        className="mt-1 h-4 w-4 shrink-0 text-emerald-500"
                        aria-hidden
                      />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center px-2">
          <Button asChild className="w-full min-w-0 max-w-sm sm:w-auto sm:min-w-[14rem]" size="lg">
            <Link href={siteConfig.links.dashboard}>{copy.backToDashboard}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <IntakeWizardPanel
      variant="page"
      intake={intake}
      answers={answers}
      onAnswerChange={(key, value) =>
        setAnswers((prev) => ({ ...prev, [key]: value }))
      }
      currentIndex={currentIndex}
      onCurrentIndexChange={setCurrentIndex}
      onSubmit={() => void handleSubmit()}
      submitting={submitting}
      error={error}
    />
  );
}
