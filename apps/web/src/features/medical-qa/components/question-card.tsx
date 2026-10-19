"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Lock, MessageCircle, Stethoscope } from "lucide-react";
import { cn } from "@zindagi/shared";
import { useTranslations } from "@/i18n/locale-provider";
import type { MedicalQuestionSummaryDto } from "../types";
import { formatAnswerCount } from "../lib/format";
import { QaText } from "./qa-text";
import { RelativeTime } from "./relative-time";

const AVATAR_TONES = [
  "from-emerald-100 to-teal-200 text-white",
  "from-teal-400 to-cyan-600 text-white",
  "from-rose-300 to-red-500 text-white",
  "from-sky-300 to-blue-500 text-white",
  "from-amber-300 to-orange-500 text-white",
  "from-violet-300 to-purple-500 text-white",
];

/** Stable per-question tone so the list looks varied without revealing anything about the author. */
function avatarTone(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function QuestionCard({ question, className }: { question: MedicalQuestionSummaryDto; className?: string }) {
  const t = useTranslations().medicalQa;
  const answered = question.answerCount > 0;

  return (
    <Link
      href={`/questions/${question.id}`}
      className={cn(
        "group block rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow sm:p-5 md:hover:shadow-premium",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold",
            avatarTone(question.id),
          )}
        >
          {t.anonymousUser.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{t.anonymousUser}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-500">
            <RelativeTime iso={question.createdAt} />
            <span aria-hidden>·</span>
            <span className="rounded-full bg-brand-muted px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
              {t.categories[question.category]}
            </span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 rtl:rotate-180" aria-hidden />
      </div>

      <h3 dir="auto" className="mt-4 line-clamp-2 text-lg font-bold leading-snug text-slate-900">
        {question.title}
      </h3>
      <QaText text={question.excerpt} className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-slate-600" />

      <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5 truncate rounded-full px-3 py-1.5 text-xs font-medium",
            answered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
          )}
        >
          <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{answered ? t.answeredByProvider : t.waitingForAnswer}</span>
        </span>
        {question.photoCount > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500" title={t.privatePhotosCount.replace("{count}", String(question.photoCount))}>
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {question.photoCount}
          </span>
        ) : null}
        <span className="ms-auto inline-flex shrink-0 items-center gap-1 text-sm text-slate-600">
          <MessageCircle className="h-4 w-4" aria-hidden />
          <span aria-hidden>{question.answerCount}</span>
          <span className="sr-only">{formatAnswerCount(question.answerCount, t)}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-brand-dark">
          {t.readMore}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
