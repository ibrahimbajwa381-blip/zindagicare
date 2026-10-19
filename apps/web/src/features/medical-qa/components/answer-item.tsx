"use client";

import { BadgeCheck } from "lucide-react";
import { cn } from "@zindagi/shared";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { MedicalAnswerDto } from "../types";
import { formatQaDate } from "../lib/format";
import { QaText } from "./qa-text";

export function AnswerItem({ answer, footer }: { answer: MedicalAnswerDto; footer?: React.ReactNode }) {
  const t = useTranslations().medicalQa;
  const { locale } = useLocale();
  const isFollowUp = answer.kind === "follow_up";
  const roleLabel = t.roles[answer.author.role];

  return (
    <article
      className={cn(
        surfaceCard,
        "p-4 sm:p-5",
        isFollowUp && "border-brand-light/40 bg-brand-muted/40",
      )}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {isFollowUp ? (
          <span className="font-semibold text-slate-800">{t.followUpLabel}</span>
        ) : (
          <>
            <span dir="auto" className="font-semibold text-slate-900">
              {answer.author.displayName || roleLabel}
            </span>
            <span className="text-slate-500">· {roleLabel}</span>
            {answer.author.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                {t.verifiedBadge}
              </span>
            ) : null}
          </>
        )}
        <time dateTime={answer.createdAt} className="ms-auto text-xs text-slate-500">
          {formatQaDate(answer.createdAt, locale)}
        </time>
      </header>
      <QaText text={answer.body} className="mt-3 text-[15px] leading-relaxed text-slate-700" />
      {footer ? <div className="mt-3">{footer}</div> : null}
    </article>
  );
}
