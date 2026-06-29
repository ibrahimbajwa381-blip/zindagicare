"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { getIntakeFormSubmittedMessage } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useTranslations } from "@/i18n/locale-provider";
import type { ChatMessageDto } from "@/features/chat/types";
import { IntakeWizardPanel } from "./intake-wizard-panel";
import type { MedicalIntakeDto } from "../types";

type IntakeSubmitResponse = {
  intake: MedicalIntakeDto;
  thankYouMessage?: ChatMessageDto | null;
};

type ChatIntakeFormProps = {
  appointmentId: string;
  threadId: string;
  doctorUserId: string;
  onThankYouMessage?: (message: ChatMessageDto) => void;
  onThankYouConfirmed?: (tempId: string, message: ChatMessageDto) => void;
};

export function ChatIntakeForm({
  appointmentId,
  threadId,
  doctorUserId,
  onThankYouMessage,
  onThankYouConfirmed,
}: ChatIntakeFormProps) {
  const t = useTranslations();
  const copy = t.intake.chatForm;

  const [intake, setIntake] = useState<MedicalIntakeDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
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
        const firstUnanswered = data.questions.findIndex(
          (q) => !(q.answer ?? "").trim(),
        );
        setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
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

    const tempId = `pending-thankyou-${Date.now()}`;
    onThankYouMessage?.({
      id: tempId,
      threadId,
      senderId: doctorUserId,
      kind: "user",
      body: getIntakeFormSubmittedMessage(intake.locale),
      createdAt: new Date().toISOString(),
      isMine: false,
      readBy: [],
    });
    setIntake((prev) => (prev ? { ...prev, status: "completed" } : prev));

    setSubmitting(true);
    setError(null);

    const payload = {
      answers: intake.questions.map((question) => ({
        key: question.key,
        answer: (answers[question.key] ?? "").trim(),
      })),
    };

    try {
      const res = await fetch(`/api/v1/intake/${appointmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success && json.data) {
        const data = json.data as IntakeSubmitResponse;
        setIntake(data.intake);
        if (data.thankYouMessage) {
          onThankYouConfirmed?.(tempId, data.thankYouMessage);
        }
      } else {
        setError(json.error?.message ?? copy.submitError);
      }
    } catch {
      setError(copy.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="shrink-0 border-b border-brand-light/20 bg-gradient-to-b from-brand-muted/30 to-white px-3 py-5 sm:px-4">
        <LoadingScreen message={copy.loading} size="sm" />
      </div>
    );
  }

  if (!intake || intake.status === "completed") {
    return null;
  }

  if (dismissed) {
    return (
      <div className="shrink-0 border-b border-brand-light/20 bg-gradient-to-r from-brand-muted/40 to-white px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark"
        >
          <ClipboardList className="h-3.5 w-3.5" aria-hidden />
          {copy.reopen}
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-brand-light/25 bg-gradient-to-b from-brand-muted/25 via-white to-white px-3 py-3 sm:px-4">
      <IntakeWizardPanel
        variant="chat"
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
        onDismiss={() => setDismissed(true)}
      />
      <div className="mt-2 flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          disabled={submitting}
          className="h-7 text-xs text-slate-500"
        >
          {copy.skip}
        </Button>
      </div>
    </div>
  );
}
