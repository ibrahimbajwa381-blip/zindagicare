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
  /** ZindagiCare (platform) rating — shown for Sunday free consults. */
  platformTitle?: string;
  platformRatingLabel?: string;
  platformCommentPlaceholder?: string;
  platformRatingRequired?: string;
  platformThankYou?: string;
};

type SubmittedReview = {
  rating: number;
  comment?: string;
};

type Props = {
  appointmentId: string;
  doctorName: string;
  copy: ReviewCopy;
  initialReview?: SubmittedReview;
  canReview: boolean;
  /** When set, the patient is also asked to rate ZindagiCare for this consult. */
  platform?: {
    canReview: boolean;
    review?: SubmittedReview;
  };
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

function SubmittedReviewCard({
  title,
  review,
  yourRating,
}: {
  title: string;
  review: SubmittedReview;
  yourRating: string;
}) {
  return (
    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3">
      <p className="text-xs font-medium text-emerald-800">{title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <InteractiveStars value={review.rating} label={yourRating} />
        <span className="text-xs text-emerald-700">
          {review.rating}/5 · {yourRating}
        </span>
      </div>
      {review.comment ? (
        <p className="mt-2 text-sm text-emerald-900/80">{review.comment}</p>
      ) : null}
    </div>
  );
}

function ReviewFields({
  id,
  title,
  ratingLabel,
  rating,
  onRating,
  comment,
  onComment,
  commentLabel,
  commentPlaceholder,
  optional,
  disabled,
}: {
  id: string;
  title: string;
  ratingLabel: string;
  rating: number;
  onRating: (value: number) => void;
  comment: string;
  onComment: (value: string) => void;
  commentLabel: string;
  commentPlaceholder: string;
  optional: string;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <div>
        <p className="text-xs font-medium text-slate-600">{ratingLabel}</p>
        <div className="mt-1.5">
          <InteractiveStars
            value={rating}
            onChange={onRating}
            disabled={disabled}
            label={ratingLabel}
          />
        </div>
      </div>
      <div>
        <label htmlFor={id} className="text-xs font-medium text-slate-600">
          {commentLabel} <span className="font-normal text-slate-400">({optional})</span>
        </label>
        <textarea
          id={id}
          value={comment}
          onChange={(event) => onComment(event.target.value)}
          placeholder={commentPlaceholder}
          maxLength={2000}
          rows={3}
          disabled={disabled}
          className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-brand/20 transition focus:border-brand-light focus:ring-2 disabled:opacity-60"
        />
      </div>
    </div>
  );
}

export function PatientAppointmentReviewAction({
  appointmentId,
  doctorName,
  copy,
  initialReview,
  canReview,
  platform,
  defaultExpanded = false,
  afterVideoLeave = false,
  onSubmitted,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [rating, setRating] = useState(initialReview?.rating ?? 0);
  const [comment, setComment] = useState(initialReview?.comment ?? "");
  const [review, setReview] = useState(initialReview);
  const [canSubmitReview, setCanSubmitReview] = useState(canReview);
  const [platformRating, setPlatformRating] = useState(0);
  const [platformComment, setPlatformComment] = useState("");
  const [platformReview, setPlatformReview] = useState(platform?.review);
  const [canSubmitPlatform, setCanSubmitPlatform] = useState(Boolean(platform?.canReview));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platformTitle = copy.platformTitle ?? "Rate ZindagiCare";
  const doctorPending = !review && canSubmitReview;
  const platformPending = !platformReview && canSubmitPlatform;

  const submitted = (
    <>
      {review ? (
        <SubmittedReviewCard title={copy.thankYou} review={review} yourRating={copy.yourRating} />
      ) : null}
      {platformReview ? (
        <SubmittedReviewCard
          title={copy.platformThankYou ?? `${platformTitle} · ${copy.thankYou}`}
          review={platformReview}
          yourRating={copy.yourRating}
        />
      ) : null}
    </>
  );

  if (!doctorPending && !platformPending) {
    return review || platformReview ? submitted : null;
  }

  if (!expanded) {
    return (
      <>
        {submitted}
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100"
            onClick={() => setExpanded(true)}
          >
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {doctorPending ? copy.rateVisit : platformTitle}
          </Button>
        </div>
      </>
    );
  }

  const query = afterVideoLeave ? "?afterVideoLeave=1" : "";

  const postReview = async (path: string, value: number, text: string) => {
    const res = await fetch(`/api/v1/appointments/${appointmentId}/${path}${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: value,
        ...(text.trim() ? { comment: text.trim() } : {}),
      }),
    });
    const json = await res.json().catch(() => null);
    if (!json?.success || !json.data) {
      throw new Error(json?.error?.message ?? copy.submitError);
    }
    return {
      rating: json.data.rating as number,
      comment: json.data.comment as string | undefined,
    };
  };

  const handleSubmit = async () => {
    if (doctorPending && rating < 1) {
      setError(copy.ratingLabel);
      return;
    }
    if (platformPending && platformRating < 1) {
      setError(copy.platformRatingRequired ?? copy.platformRatingLabel ?? platformTitle);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Each part is saved independently so a failure in one never loses the other.
      if (doctorPending) {
        setReview(await postReview("review", rating, comment));
        setCanSubmitReview(false);
      }
      if (platformPending) {
        setPlatformReview(await postReview("platform-review", platformRating, platformComment));
        setCanSubmitPlatform(false);
      }
      setExpanded(false);
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {submitted}
      <div className="mt-3 space-y-4 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-3">
        {doctorPending ? (
          <ReviewFields
            id={`review-comment-${appointmentId}`}
            title={`${copy.rateVisit} · ${doctorName}`}
            ratingLabel={copy.ratingLabel}
            rating={rating}
            onRating={setRating}
            comment={comment}
            onComment={setComment}
            commentLabel={copy.commentLabel}
            commentPlaceholder={copy.commentPlaceholder}
            optional={copy.optional}
            disabled={submitting}
          />
        ) : null}

        {platformPending ? (
          <div className={cn(doctorPending && "border-t border-amber-100 pt-4")}>
            <ReviewFields
              id={`platform-review-comment-${appointmentId}`}
              title={platformTitle}
              ratingLabel={copy.platformRatingLabel ?? copy.ratingLabel}
              rating={platformRating}
              onRating={setPlatformRating}
              comment={platformComment}
              onComment={setPlatformComment}
              commentLabel={copy.commentLabel}
              commentPlaceholder={copy.platformCommentPlaceholder ?? copy.commentPlaceholder}
              optional={copy.optional}
              disabled={submitting}
            />
          </div>
        ) : null}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={
              submitting || (doctorPending && rating < 1) || (platformPending && platformRating < 1)
            }
            loading={submitting}
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
    </>
  );
}
