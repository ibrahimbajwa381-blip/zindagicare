"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@zindagi/shared";

type ReviewCopy = {
  rateVisit: string;
  yourRating: string;
  ratingLabel: string;
  commentLabel: string;
  commentPlaceholder: string;
  submit: string;
  submitting: string;
  submitError: string;
  thankYou: string;
  optional: string;
  cancel: string;
};

type Props = {
  appointmentId: string;
  doctorName: string;
  copy: ReviewCopy;
  initialReview?: {
    rating: number;
    comment?: string;
  };
  canReview: boolean;
  defaultExpanded?: boolean;
  afterVideoLeave?: boolean;
  onSubmitted?: () => void;
};

function InteractiveStars({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange?: (rating: number) => void;
  disabled?: boolean;
  label: string;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role={onChange ? "radiogroup" : undefined}
      aria-label={label}
    >
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1;
        const filled = starValue <= (hover || value);

        return (
          <button
            key={starValue}
            type="button"
            disabled={disabled || !onChange}
            aria-label={`${starValue} ${starValue === 1 ? "star" : "stars"}`}
            aria-pressed={onChange ? value === starValue : undefined}
            className={cn(
              "rounded p-0.5 transition-colors",
              onChange && !disabled
                ? "cursor-pointer hover:scale-105"
                : "cursor-default",
            )}
            onClick={() => onChange?.(starValue)}
            onMouseEnter={() => onChange && setHover(starValue)}
            onMouseLeave={() => onChange && setHover(0)}
          >
            <Star
              className={cn(
                "h-5 w-5",
                filled ? "fill-amber-400 text-amber-400" : "text-slate-300",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function PatientAppointmentReviewAction({
  appointmentId,
  doctorName,
  copy,
  initialReview,
  canReview,
  defaultExpanded = false,
  afterVideoLeave = false,
  onSubmitted,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [rating, setRating] = useState(initialReview?.rating ?? 0);
  const [comment, setComment] = useState(initialReview?.comment ?? "");
  const [review, setReview] = useState(initialReview);
  const [canSubmitReview, setCanSubmitReview] = useState(canReview);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (review) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3">
        <p className="text-xs font-medium text-emerald-800">{copy.thankYou}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <InteractiveStars value={review.rating} label={copy.yourRating} />
          <span className="text-xs text-emerald-700">
            {review.rating}/5 · {copy.yourRating}
          </span>
        </div>
        {review.comment ? (
          <p className="mt-2 text-sm text-emerald-900/80">{review.comment}</p>
        ) : null}
      </div>
    );
  }

  if (!canSubmitReview) {
    return null;
  }

  if (!expanded) {
    return (
      <div className="mt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100"
          onClick={() => setExpanded(true)}
        >
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {copy.rateVisit}
        </Button>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (rating < 1) {
      setError(copy.ratingLabel);
      return;
    }

    setSubmitting(true);
    setError(null);

    const query = afterVideoLeave ? "?afterVideoLeave=1" : "";
    const res = await fetch(`/api/v1/appointments/${appointmentId}/review${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      }),
    });
    const json = await res.json();

    if (json.success && json.data) {
      setReview({
        rating: json.data.rating as number,
        comment: json.data.comment as string | undefined,
      });
      setCanSubmitReview(false);
      setExpanded(false);
      onSubmitted?.();
    } else {
      setError(json.error?.message ?? copy.submitError);
    }

    setSubmitting(false);
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-3">
      <p className="text-sm font-medium text-slate-900">
        {copy.rateVisit} · {doctorName}
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-medium text-slate-600">{copy.ratingLabel}</p>
          <div className="mt-1.5">
            <InteractiveStars
              value={rating}
              onChange={setRating}
              disabled={submitting}
              label={copy.ratingLabel}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={`review-comment-${appointmentId}`}
            className="text-xs font-medium text-slate-600"
          >
            {copy.commentLabel}{" "}
            <span className="font-normal text-slate-400">({copy.optional})</span>
          </label>
          <textarea
            id={`review-comment-${appointmentId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={copy.commentPlaceholder}
            maxLength={2000}
            rows={3}
            disabled={submitting}
            className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-brand/20 transition focus:border-brand-light focus:ring-2 disabled:opacity-60"
          />
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || rating < 1}
          >
            {submitting ? copy.submitting : copy.submit}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={submitting}
            onClick={() => {
              setExpanded(false);
              setError(null);
            }}
          >
            {copy.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
