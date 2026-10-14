"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Flag, Lock, PenLine, Trash2 } from "lucide-react";
import { cn } from "@zindagi/shared";
import { MEDICAL_QA_LIMITS, MedicalQaReportReasons } from "@zindagi/validators";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useEventSourceListener } from "@/lib/realtime/use-event-source";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { MedicalAnswerDto, MedicalQuestionDetailDto } from "../types";
import { deleteQuestion, fetchQuestion, postAnswer, reportContent } from "../lib/qa-api";
import { createOwnEchoFilter, createRefreshCoordinator, type RefreshCoordinator } from "../lib/live-refresh";
import { formatAnswerCount, formatQaDate } from "../lib/format";
import { AnswerItem } from "./answer-item";
import { EmergencyNotice } from "./emergency-notice";
import { QaText } from "./qa-text";

const textareaClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base shadow-sm placeholder:text-slate-400 focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:rounded-lg sm:px-3 sm:text-sm";

export function QuestionThread({
  initial,
  photosFailed = false,
}: {
  initial: MedicalQuestionDetailDto;
  photosFailed?: boolean;
}) {
  const t = useTranslations().medicalQa;
  const { locale } = useLocale();
  const router = useRouter();
  const [data, setData] = useState(initial);
  const { question, answers, photos, viewer } = data;

  const refresher = useRef<RefreshCoordinator | null>(null);
  const ownEchoes = useRef(createOwnEchoFilter());
  useEffect(() => {
    const coordinator = createRefreshCoordinator({
      load: (signal) => fetchQuestion(question.id, signal),
      apply: setData,
      // On failure keep showing what we have; the next event or resync catches up.
    });
    refresher.current = coordinator;
    return () => {
      coordinator.dispose();
      if (refresher.current === coordinator) refresher.current = null;
    };
  }, [question.id]);

  // Events carry ids only; the page re-fetches through the authorized API.
  // Resyncs (reconnect, tab visible again) arrive here too as { type: "resync" }.
  useEventSourceListener(`/api/v1/medical-questions/${question.id}/events`, (event) => {
    if (ownEchoes.current.isOwnEcho(event)) return;
    refresher.current?.schedule();
  });

  async function onPosted(answer: MedicalAnswerDto) {
    ownEchoes.current.remember(answer.id);
    await refresher.current?.now();
  }

  async function onDelete() {
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      await deleteQuestion(question.id);
      router.push("/questions");
    } catch {
      window.alert(t.form.errorGeneric);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/questions" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-dark hover:underline">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        {t.backToList}
      </Link>

      <article className={cn(surfaceCard, "p-5 sm:p-7")}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-brand-muted px-2.5 py-0.5 font-medium text-brand-dark">
            {t.categories[question.category]}
          </span>
          <time dateTime={question.createdAt} className="text-slate-500">
            {formatQaDate(question.createdAt, locale)}
          </time>
          <span className="text-slate-500">· {formatAnswerCount(question.answerCount, t)}</span>
        </div>
        <h1 dir="auto" className="mt-3 font-display text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">
          {question.title}
        </h1>
        <QaText text={question.body} className="mt-3 text-[15px] leading-relaxed text-slate-700" />

        {photos && photos.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Lock className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              {t.privatePhotosTitle}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked API image; must not go through the public image optimizer */}
                  <img src={p.url} alt="" width={p.width} height={p.height} loading="lazy" className="aspect-square h-full w-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        ) : !photos && question.photoCount > 0 ? (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {t.privatePhotosNote.replace("{count}", String(question.photoCount))}
          </p>
        ) : null}

        {photosFailed ? (
          <p role="alert" className="mt-4 text-sm font-medium text-amber-700">
            {t.form.photosPartial}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {viewer.canReport ? <ReportButton questionId={question.id} targetType="question" targetId={question.id} /> : null}
          {viewer.canDelete ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" aria-hidden />
              {t.deleteQuestion}
            </Button>
          ) : null}
        </div>
      </article>

      <EmergencyNotice />

      <section aria-labelledby="qa-answers-heading" className="space-y-3">
        <h2 id="qa-answers-heading" className="text-lg font-semibold text-slate-900">
          {t.answersTitle} <span className="text-slate-500">({question.answerCount})</span>
        </h2>
        {answers.length === 0 ? (
          <p className={cn(surfaceCard, "p-5 text-sm text-slate-600")}>{t.noAnswersYet}</p>
        ) : (
          answers.map((a) => (
            <AnswerItem
              key={a.id}
              answer={a}
              footer={
                viewer.isSignedIn && a.kind === "answer" ? (
                  <ReportButton questionId={question.id} targetType="answer" targetId={a.id} />
                ) : null
              }
            />
          ))
        )}
        <p className="text-xs text-slate-500">{t.disclaimer}</p>
      </section>

      {viewer.canAnswer ? (
        <ReplyBox
          questionId={question.id}
          title={t.writeAnswer}
          placeholder={t.answerPlaceholder}
          submitLabel={t.postAnswer}
          note={t.answerSafetyNote}
          onPosted={onPosted}
        />
      ) : viewer.canFollowUp ? (
        <ReplyBox
          questionId={question.id}
          title={t.followUpTitle}
          placeholder={t.followUpPlaceholder}
          submitLabel={t.postFollowUp}
          onPosted={onPosted}
        />
      ) : (
        <div className={cn(surfaceCard, "flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between")}>
          <p className="text-sm text-slate-600">{t.providerOnlyNote}</p>
          <div className="flex flex-wrap gap-2">
            {!viewer.isSignedIn ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/login?callbackUrl=${encodeURIComponent(`/questions/${question.id}`)}`}>{t.loginToAnswer}</Link>
              </Button>
            ) : null}
            <Button asChild size="sm">
              <Link href="/questions/ask">
                <PenLine className="h-4 w-4" aria-hidden />
                {t.askAnother}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReplyBox({
  questionId,
  title,
  placeholder,
  submitLabel,
  note,
  onPosted,
}: {
  questionId: string;
  title: string;
  placeholder: string;
  submitLabel: string;
  note?: string;
  onPosted: (answer: MedicalAnswerDto) => Promise<void>;
}) {
  const t = useTranslations().medicalQa;
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef("");
  useEffect(() => {
    key.current = crypto.randomUUID();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || body.trim().length < MEDICAL_QA_LIMITS.answerMin) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await postAnswer(questionId, body, key.current);
      setBody("");
      key.current = crypto.randomUUID();
      await onPosted(answer);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.form.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={cn(surfaceCard, "space-y-3 p-5 sm:p-6")}>
      <label htmlFor={`reply-${questionId}`} className="block text-base font-semibold text-slate-900">
        {title}
      </label>
      {note ? <p className="text-xs text-slate-600">{note}</p> : null}
      <textarea
        id={`reply-${questionId}`}
        dir="auto"
        rows={5}
        value={body}
        maxLength={MEDICAL_QA_LIMITS.answerMax}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        className={textareaClass}
      />
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={busy} disabled={body.trim().length < MEDICAL_QA_LIMITS.answerMin}>
        {submitLabel}
      </Button>
    </form>
  );
}

function ReportButton({
  questionId,
  targetType,
  targetId,
}: {
  questionId: string;
  targetType: "question" | "answer";
  targetId: string;
}) {
  const t = useTranslations().medicalQa;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof MedicalQaReportReasons)[number]>("misleading");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  if (state === "done") return <span className="text-xs font-medium text-emerald-700">{t.reported}</span>;

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-slate-500">
        <Flag className="h-4 w-4" aria-hidden />
        {t.report}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm">
      <label className="sr-only" htmlFor={`report-${targetId}`}>
        {t.reportPrompt}
      </label>
      <select
        id={`report-${targetId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value as typeof reason)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
      >
        {MedicalQaReportReasons.map((r) => (
          <option key={r} value={r}>
            {t.reportReasons[r]}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        loading={state === "sending"}
        onClick={async () => {
          setState("sending");
          try {
            await reportContent(questionId, { targetType, targetId, reason });
            setState("done");
          } catch {
            setState("idle");
          }
        }}
      >
        {t.reportSubmit}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        {t.reportCancel}
      </Button>
    </div>
  );
}
