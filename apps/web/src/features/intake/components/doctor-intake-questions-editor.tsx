"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/locale-provider";
import type { DoctorIntakeQuestionDto } from "../types";

function newQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Doctor-facing editor for the pre-consult intake question list.
 * Saving applies to future bookings only; in-flight intakes keep their snapshot.
 */
export function DoctorIntakeQuestionsEditor() {
  const t = useTranslations();
  const copy = t.intake.editor;

  const [questions, setQuestions] = useState<DoctorIntakeQuestionDto[]>([]);
  const [isCustomized, setIsCustomized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/doctor/intake-questions");
    const json = await res.json();
    if (json.success && json.data) {
      setQuestions(json.data.questions as DoctorIntakeQuestionDto[]);
      setIsCustomized(!!json.data.isCustomized);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateQuestion = (id: string, patch: Partial<DoctorIntakeQuestionDto>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    setQuestions((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const remove = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const add = () => {
    setQuestions((prev) => [
      ...prev,
      { id: newQuestionId(), text: "", order: prev.length, isActive: true },
    ]);
  };

  const save = async (list: DoctorIntakeQuestionDto[]) => {
    setSaving(true);
    setFeedback(null);

    const payload = {
      questions: list
        .filter((q) => q.text.trim().length > 0)
        .map((q, index) => ({
          id: q.id,
          text: q.text.trim(),
          order: index,
          isActive: q.isActive,
        })),
    };

    const res = await fetch("/api/v1/doctor/intake-questions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (json.success && json.data) {
      setQuestions(json.data.questions as DoctorIntakeQuestionDto[]);
      setIsCustomized(!!json.data.isCustomized);
      setFeedback({ ok: true, text: copy.saveSuccess });
    } else {
      setFeedback({ ok: false, text: json.error?.message ?? copy.saveError });
    }
    setSaving(false);
  };

  if (loading) {
    return <p className="text-sm text-slate-500">…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-base font-semibold text-foreground">
          {copy.title}
        </h3>
        <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
        <p className="mt-1 text-xs text-slate-400">
          {isCustomized ? copy.customNote : copy.defaultNote}
        </p>
      </div>

      <ol className="space-y-3">
        {questions.map((question, index) => (
          <li
            key={question.id}
            className="rounded-xl border border-slate-200/80 bg-white/90 p-3"
          >
            <div className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-center text-sm font-semibold text-slate-400">
                {index + 1}.
              </span>
              <textarea
                value={question.text}
                onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                rows={2}
                maxLength={300}
                placeholder={copy.questionPlaceholder}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-8">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={question.isActive}
                  onChange={(e) =>
                    updateQuestion(question.id, { isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 accent-[var(--brand,#0fa79b)]"
                />
                {copy.activeLabel}
              </label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => move(index, 1)}
                  disabled={index === questions.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => remove(question.id)}
                  aria-label={copy.removeQuestion}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {feedback && (
        <p
          className={`text-sm ${feedback.ok ? "text-emerald-600" : "text-red-600"}`}
        >
          {feedback.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          {copy.addQuestion}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => save(questions)}
          disabled={saving}
        >
          {saving ? copy.saving : copy.save}
        </Button>
        {isCustomized && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => save([])}
            disabled={saving}
          >
            {copy.resetToDefaults}
          </Button>
        )}
      </div>
    </div>
  );
}
