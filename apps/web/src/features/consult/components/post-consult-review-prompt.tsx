"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { siteConfig } from "@/config/site";
import { useTranslations } from "@/i18n/locale-provider";
import { PatientAppointmentReviewAction } from "@/features/patient/components/patient-appointment-review-action";

type Props = {
  appointmentId: string;
};

type ReviewState = {
  canReview: boolean;
  doctorName: string;
  review?: {
    rating: number;
    comment?: string;
  };
};

export function PostConsultReviewPrompt({ appointmentId }: Props) {
  const t = useTranslations();
  const copy = t.dashboard.appointmentHistory.review;
  const videoCopy = t.consult.videoLeft;
  const [state, setState] = useState<ReviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/appointments/${appointmentId}/review?afterVideoLeave=1`,
      );
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? videoCopy.reviewLoadError);
      }
      setState(json.data as ReviewState);
    } catch (e) {
      setError(e instanceof Error ? e.message : videoCopy.reviewLoadError);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, videoCopy.reviewLoadError]);

  useEffect(() => {
    load();
  }, [load]);

  const showReview =
    state && (state.canReview || state.review) && !loading && !error;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold text-foreground">
          {videoCopy.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{videoCopy.description}</p>
        <Button asChild className="mt-6">
          <Link href={siteConfig.links.dashboard}>{videoCopy.backToDashboard}</Link>
        </Button>
      </div>

      {loading ? (
        <LoadingScreen message={videoCopy.loadingReview} size="md" />
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {showReview ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-6 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {videoCopy.reviewTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{videoCopy.reviewDescription}</p>
            </div>
          </div>
          <PatientAppointmentReviewAction
            appointmentId={appointmentId}
            doctorName={state.doctorName}
            copy={copy}
            initialReview={state.review}
            canReview={state.canReview}
            defaultExpanded={state.canReview}
            afterVideoLeave
            onSubmitted={load}
          />
        </div>
      ) : null}
    </div>
  );
}
