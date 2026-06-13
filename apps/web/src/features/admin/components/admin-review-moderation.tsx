"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Star, Trash2 } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { surfaceCard, surfaceInset } from "@/lib/ui/surfaces";

type AdminReviewRow = {
  id: string;
  appointmentId: string;
  doctorId: string;
  rating: number;
  comment?: string;
  isVisible: boolean;
  isModerated: boolean;
  createdAt: string;
  patientName: string;
  doctorName: string;
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "visible", label: "Public" },
  { value: "hidden", label: "Hidden" },
] as const;

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn(
            "h-3.5 w-3.5",
            index < rating ? "fill-amber-400 text-amber-400" : "text-slate-200",
          )}
        />
      ))}
    </span>
  );
}

export function AdminReviewModeration() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [reviews, setReviews] = useState<AdminReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = filter === "all" ? "" : `?visibility=${filter}`;
    fetch(`/api/v1/admin/reviews${qs}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setError(undefined);
          setReviews(json.data?.reviews ?? []);
          setTotal(json.data?.total ?? 0);
        } else {
          setError(json?.error?.message ?? "Failed to load reviews");
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load reviews");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  async function moderate(review: AdminReviewRow, action: "hide" | "show" | "delete") {
    if (action === "delete") {
      const confirmed = window.confirm(
        `Permanently remove this review from ${review.patientName}? Doctor ratings will be recalculated.`,
      );
      if (!confirmed) return;
    }

    setPendingId(review.id);
    try {
      const res = await fetch("/api/v1/admin/reviews/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, action }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json?.error?.message ?? "Action failed");
      }
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filter === item.value
                  ? "bg-brand text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500">{total} review{total === 1 ? "" : "s"}</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading reviews…</p>
      ) : error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : reviews.length === 0 ? (
        <div className={`border-dashed p-8 text-center text-sm text-slate-500 ${surfaceInset}`}>
          No reviews in this filter yet.
        </div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className={cn(surfaceCard, "p-5")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <RatingStars rating={review.rating} />
                    <span className="text-sm font-medium text-slate-900">
                      {review.rating}/5
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] uppercase tracking-wide",
                        review.isVisible
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-600",
                      )}
                    >
                      {review.isVisible ? "Public" : "Hidden"}
                    </Badge>
                    {review.isModerated ? (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        Moderated
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-medium">{review.patientName}</span>
                    <span className="text-slate-400"> → </span>
                    <span className="font-medium">{review.doctorName}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatKarachiDateTime(review.createdAt)}
                  </p>
                  {review.comment ? (
                    <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                      {review.comment}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm italic text-slate-400">No written comment.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {review.isVisible ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pendingId === review.id}
                      className="gap-1.5"
                      onClick={() => moderate(review, "hide")}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      Hide
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pendingId === review.id}
                      className="gap-1.5"
                      onClick={() => moderate(review, "show")}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Show
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pendingId === review.id}
                    className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => moderate(review, "delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
