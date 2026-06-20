"use client";

import { useCallback, useEffect, useState } from "react";
import { HomeVisitStatuses } from "@zindagi/shared";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { HomeVisitReviewAction } from "./home-visit-review-action";
import type { HomeVisitReviewState } from "@/server/services/home-visit-review.service";

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
  visitId: string;
  copy: ReviewCopy;
};

export function HomeVisitReviewSection({ visitId, copy }: Props) {
  const [state, setState] = useState<HomeVisitReviewState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/home-visits/${visitId}/review`);
      const json = await res.json();
      if (json.success) {
        setState(json.data as HomeVisitReviewState);
      }
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <LoadingScreen message={`${copy.rateVisit}…`} size="md" />;
  }

  if (!state || (!state.canReview && !state.review)) {
    return null;
  }

  return (
    <HomeVisitReviewAction
      visitId={visitId}
      staffName={state.staffName}
      copy={copy}
      initialReview={state.review}
      canReview={state.canReview}
      defaultExpanded={state.canReview}
      onSubmitted={load}
    />
  );
}

export function isHomeVisitReviewEligible(status: string) {
  return status === HomeVisitStatuses.COMPLETED;
}
