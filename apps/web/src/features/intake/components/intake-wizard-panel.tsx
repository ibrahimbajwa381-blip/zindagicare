"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Lock,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/messages";
import { getQuestionMeta } from "../lib/question-meta";
import type { MedicalIntakeDto } from "../types";

type FlowLabels = {
  patient: string;
  intake: string;
  doctor: string;
  consult: string;
};

function IntakeFlowStrip({
  labels,
  activeStep,
  compact = false,
}: {
  labels: FlowLabels;
  activeStep: "intake" | "doctor";
  compact?: boolean;
}) {
  const steps = [
    { key: "patient", label: labels.patient, icon: User },
    { key: "intake", label: labels.intake, icon: Sparkles },
    { key: "doctor", label: labels.doctor, icon: CheckCircle2 },
    { key: "consult", label: labels.consult, icon: ChevronRight },
  ] as const;

  const iconSize = compact ? "h-7 w-7" : "h-9 w-9 sm:h-10 sm:w-10";
  const iconInner = compact ? "h-3 w-3" : "h-4 w-4";

  return (
    <div className="flex items-center justify-between gap-0.5 sm:gap-2">
      {steps.map((step, index) => {
        const isActive =
          (step.key === "intake" && activeStep === "intake") ||
          (step.key === "doctor" && activeStep === "doctor");
        const isPast =
          (activeStep === "doctor" && (step.key === "patient" || step.key === "intake")) ||
          step.key === "patient";
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  "flex items-center justify-center rounded-full border-2 transition-all",
                  iconSize,
                  isActive
                    ? "border-brand bg-brand text-white shadow-md shadow-brand/25"
                    : isPast
                      ? "border-emerald-400 bg-emerald-50 text-emerald-600"
                      : "border-slate-200 bg-white text-slate-400",
                )}
              >
                {isPast && !isActive ? (
                  <Check className={iconInner} aria-hidden />
                ) : (
                  <Icon className={iconInner} aria-hidden />
                )}
              </span>
              {!compact && (
                <span
                  className={cn(
                    "hidden text-center text-[10px] font-semibold leading-tight sm:block sm:text-[11px]",
                    isActive ? "text-brand-dark" : isPast ? "text-emerald-700" : "text-slate-400",
                  )}
                >
                  {step.label}
                </span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                aria-hidden
                className={cn(
                  "h-0.5 w-full max-w-4 rounded-full sm:max-w-8",
                  compact ? "mb-0" : "mb-4 sm:mb-6",
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

function ProgressRing({
  percent,
  size = "md",
  label,
}: {
  percent: number;
  size?: "sm" | "md";
  label: string;
}) {
  const dim = size === "sm" ? "h-10 w-10" : "h-14 w-14";
  const text = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <div
      className={cn("relative flex items-center justify-center", dim)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg className={cn(dim, "-rotate-90")} viewBox="0 0 56 56" aria-hidden>
        <circle
          cx="28"
          cy="28"
          r="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-slate-200"
        />
        <circle
          cx="28"
          cy="28"
          r="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * 150.8} 150.8`}
          className="text-brand transition-[stroke-dasharray] duration-500 ease-out"
        />
      </svg>
      <span className={cn("absolute font-bold tabular-nums text-brand-dark", text)}>
        {percent}%
      </span>
    </div>
  );
}

export type IntakeWizardPanelProps = {
  variant: "page" | "chat";
  intake: MedicalIntakeDto;
  answers: Record<string, string>;
  onAnswerChange: (key: string, value: string) => void;
  currentIndex: number;
  onCurrentIndexChange: (index: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  onDismiss?: () => void;
};

export function IntakeWizardPanel({
  variant,
  intake,
  answers,
  onAnswerChange,
  currentIndex,
  onCurrentIndexChange,
  onSubmit,
  submitting,
  error,
  onDismiss,
}: IntakeWizardPanelProps) {
  const t = useTranslations();
  const copy = t.intake;
  const wizard = copy.wizard;
  const isChat = variant === "chat";

  const flowLabels = {
    patient: wizard.flowPatient,
    intake: wizard.flowIntake,
    doctor: wizard.flowDoctor,
    consult: wizard.flowConsult,
  };

  const totalQuestions = intake.questions.length;
  const answeredCount = Object.values(answers).filter((v) => v.trim().length > 0).length;
  const progressPercent =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const currentQuestion = intake.questions[currentIndex];
  const currentMeta = currentQuestion ? getQuestionMeta(currentQuestion.key) : null;
  const CurrentIcon = currentMeta?.icon;
  const categoryLabel = currentQuestion
    ? wizard.categories[currentMeta!.categoryKey]
    : "";

  const isLastQuestion = currentIndex === totalQuestions - 1;
  const isFirstQuestion = currentIndex === 0;

  const goNext = () => {
    if (isLastQuestion) {
      onSubmit();
    } else {
      onCurrentIndexChange(Math.min(currentIndex + 1, totalQuestions - 1));
    }
  };

  const goPrevious = () => {
    onCurrentIndexChange(Math.max(currentIndex - 1, 0));
  };

  if (!currentQuestion || !currentMeta || !CurrentIcon) return null;

  const submitLabel = isChat ? t.intake.chatForm.submit : wizard.submit;
  const submittingLabel = isChat ? t.intake.chatForm.submitting : copy.submitting;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 max-w-full flex-col border border-brand-light/35 bg-white shadow-premium",
        isChat
          ? "max-h-[min(58vh,28rem)] overflow-hidden rounded-2xl"
          : "overflow-visible rounded-xl sm:rounded-2xl",
      )}
    >
      <div
        className={cn(
          "shrink-0 border-b border-brand-light/20 bg-gradient-to-br from-brand-muted/70 via-white to-accent-muted/25",
          isChat ? "px-3 py-3" : "px-4 py-4 sm:px-6 sm:py-5",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <IntakeFlowStrip labels={flowLabels} activeStep="intake" compact={isChat} />
          </div>
          {isChat && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="-mr-1 shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
              aria-label={t.intake.chatForm.skip}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div
          className={cn(
            "flex flex-col gap-3 border-t border-brand-light/15 sm:flex-row sm:items-start sm:justify-between",
            isChat ? "mt-3 pt-3" : "mt-4 pt-4 sm:mt-5 sm:pt-5",
          )}
        >
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "font-display font-semibold leading-snug text-slate-900",
                isChat ? "text-sm" : "text-base sm:text-lg md:text-xl",
              )}
            >
              {wizard.heroTagline}
            </p>
            <p
              className={cn(
                "mt-1 flex items-start gap-1 text-slate-600 sm:items-center",
                isChat ? "text-[11px] leading-snug" : "text-xs leading-relaxed sm:text-sm",
              )}
            >
              <Lock className="mt-0.5 h-3 w-3 shrink-0 text-brand sm:mt-0" aria-hidden />
              <span className="min-w-0">{wizard.heroSubtitle}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-start sm:justify-end">
            <ProgressRing
              percent={progressPercent}
              size={isChat ? "sm" : "md"}
              label={formatMessage(copy.progressAnswered, {
                answered: answeredCount,
                total: totalQuestions,
              })}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "max-w-full min-w-0 shrink-0 border-b border-slate-100 px-3 py-2.5 sm:px-4",
          isChat
            ? "flex gap-1.5 overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "grid grid-cols-2 gap-2 sm:grid-cols-3",
        )}
      >
        {intake.questions.map((question, index) => {
          const meta = getQuestionMeta(question.key);
          const Icon = meta.icon;
          const label = wizard.categories[meta.categoryKey];
          const hasAnswer = (answers[question.key] ?? "").trim().length > 0;
          const isCurrent = index === currentIndex;

          return (
            <button
              key={question.key}
              type="button"
              onClick={() => onCurrentIndexChange(index)}
              className={cn(
                "flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-left transition-all",
                isChat && "shrink-0 snap-start",
                isCurrent
                  ? "border-brand bg-brand text-white shadow-sm shadow-brand/20"
                  : hasAnswer
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  isCurrent
                    ? "bg-white/20"
                    : hasAnswer
                      ? "bg-emerald-100 text-emerald-600"
                      : cn(meta.iconBg, "text-white"),
                )}
              >
                {hasAnswer && !isCurrent ? (
                  <Check className="h-3 w-3" aria-hidden />
                ) : (
                  <Icon className="h-3 w-3" aria-hidden />
                )}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 text-[10px] font-semibold leading-tight sm:text-[11px]",
                  isChat ? "truncate" : "line-clamp-2",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          isChat ? "px-3 py-3" : "px-4 py-4 sm:px-7 sm:py-6",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                isChat ? "h-9 w-9" : "h-10 w-10 sm:h-12 sm:w-12 sm:rounded-2xl sm:shadow-md",
                currentMeta.iconBg,
              )}
            >
              <CurrentIcon className={isChat ? "h-4 w-4" : "h-5 w-5 sm:h-6 sm:w-6"} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
                {formatMessage(wizard.stepOf, {
                  current: currentIndex + 1,
                  total: totalQuestions,
                })}
              </p>
              <p
                className={cn(
                  "truncate font-semibold",
                  currentMeta.accent,
                  isChat ? "text-xs" : "text-sm",
                )}
              >
                {categoryLabel}
              </p>
            </div>
          </div>
          <span className="w-fit shrink-0 rounded-full border border-brand-light/40 bg-brand-muted/60 px-2 py-0.5 text-[10px] font-medium text-brand-dark">
            {copy.optionalHintShort}
          </span>
        </div>

        <h3
          className={cn(
            "mt-3 break-words font-display font-semibold leading-snug text-slate-900",
            isChat ? "text-sm" : "text-base sm:text-lg md:text-xl",
          )}
        >
          {currentQuestion.text}
        </h3>
        <textarea
          value={answers[currentQuestion.key] ?? ""}
          onChange={(e) => onAnswerChange(currentQuestion.key, e.target.value)}
          rows={isChat ? 3 : 4}
          maxLength={2000}
          placeholder={copy.answerPlaceholder}
          className={cn(
            "mt-3 w-full min-w-0 resize-none rounded-xl border border-slate-200/80 bg-white text-foreground shadow-sm",
            "placeholder:text-slate-400 focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25",
            isChat
              ? "px-3 py-2.5 text-sm"
              : "rounded-2xl px-3.5 py-3 text-base focus:ring-4 sm:px-4 sm:py-3.5",
          )}
        />
      </div>

      <div
        className={cn(
          "shrink-0 border-t border-slate-100 bg-white/95 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          isChat ? "px-3 py-2.5" : "px-4 py-3 sm:px-7 sm:py-5",
        )}
      >
        {error && (
          <p
            className={cn(
              "mb-2 rounded-lg border border-red-200/70 bg-red-50/80 text-red-700",
              isChat ? "px-2.5 py-1.5 text-xs" : "mb-3 rounded-xl px-3 py-2 text-sm",
            )}
          >
            {error}
          </p>
        )}
        <div
          className={cn(
            "flex flex-col gap-2",
            isChat ? "flex-wrap sm:flex-row" : "sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <Button
            type="button"
            variant="outline"
            size={isChat ? "sm" : "default"}
            onClick={goPrevious}
            disabled={isFirstQuestion || submitting}
            className={cn("w-full sm:w-auto", !isChat && "sm:shrink-0")}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {wizard.previous}
          </Button>

          <div className={cn("flex w-full gap-2", !isChat && "sm:w-auto sm:flex-none")}>
            {!isLastQuestion && (
              <Button
                type="button"
                variant="ghost"
                size={isChat ? "sm" : "default"}
                onClick={goNext}
                disabled={submitting}
                className="min-w-0 flex-1 text-slate-500 sm:flex-none"
              >
                {wizard.skipQuestion}
              </Button>
            )}
            <Button
              type="button"
              size={isChat ? "sm" : "lg"}
              onClick={goNext}
              disabled={submitting}
              loading={submitting && isLastQuestion}
              className="min-w-0 flex-1 sm:min-w-[10rem] sm:flex-none"
            >
              {isLastQuestion ? (
                submitting ? (
                  submittingLabel
                ) : (
                  submitLabel
                )
              ) : (
                <>
                  {wizard.next}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
