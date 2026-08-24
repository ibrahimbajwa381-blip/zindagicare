"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { surfaceCard } from "@/lib/ui/surfaces";

export function PublicReviewForm() {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (content.trim().length < 10) {
      setError("Please write a few more words about your experience.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const res = await fetch("/api/v1/testimonials/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: name.trim(),
          content: content.trim(),
          rating,
          website,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json?.error?.message ?? "Could not submit your review.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your review.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={cn(surfaceCard, "p-8 text-center")}>
        <p className="font-display text-lg font-semibold text-emerald-700">Thank you!</p>
        <p className="mt-2 text-sm text-slate-600">
          Your review is now live on our website. We appreciate you taking the time to share it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn(surfaceCard, "space-y-5 p-6 sm:p-8")}>
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />

      <div>
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Seerat Hassan"
        />
      </div>

      <div>
        <Label>Rating</Label>
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
                    "h-7 w-7 transition-colors",
                    value <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="content">Your review</Label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Tell us about your experience with ZindagiCare…"
          rows={5}
          maxLength={3000}
          className="flex w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-foreground shadow-sm placeholder:text-slate-400 focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25"
        />
      </div>

      <FieldError message={error} />

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Posting…" : "Post my review"}
      </Button>
    </form>
  );
}
