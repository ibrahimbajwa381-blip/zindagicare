"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { surfaceCard } from "@/lib/ui/surfaces";
import { useTranslations } from "@/i18n/locale-provider";

export function PatientTestimonialSection() {
  const t = useTranslations().testimonials.submit;
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (content.trim().length < 10) {
      setError(t.tooShort);
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const res = await fetch("/api/v1/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), rating }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json?.error?.message ?? t.failed);
      }
      setSubmitted(true);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={cn(surfaceCard, "p-6 text-center")}>
        <p className="text-sm font-medium text-emerald-700">{t.thankYou}</p>
      </div>
    );
  }

  return (
    <div className={cn(surfaceCard, "p-6")}>
      <h3 className="font-display text-lg font-semibold text-slate-900">{t.title}</h3>
      <p className="mt-1 text-sm text-slate-500">{t.description}</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, index) => {
            const value = index + 1;
            return (
              <button
                key={value}
                type="button"
                aria-label={`${value} star`}
                onClick={() => setRating(value)}
                className="p-0.5"
              >
                <Star
                  className={cn(
                    "h-6 w-6 transition-colors",
                    value <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200",
                  )}
                />
              </button>
            );
          })}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t.placeholder}
          rows={4}
          maxLength={3000}
          className="flex w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-foreground shadow-sm placeholder:text-slate-400 focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25"
        />

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? t.submitting : t.submit}
        </Button>
      </form>
    </div>
  );
}
