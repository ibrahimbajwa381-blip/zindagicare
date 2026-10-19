"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Heart, Share2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SocialLinks } from "@/components/shared/social-links";
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
  prescription?: {
    id: string;
    downloadUrl: string;
  };
  /** ZindagiCare's own rating for this consult. */
  platform?: {
    canReview: boolean;
    review?: {
      rating: number;
      comment?: string;
    };
  };
};

export function PostConsultReviewPrompt({ appointmentId }: Props) {
  const t = useTranslations();
  const copy = t.dashboard.appointmentHistory.review;
  const videoCopy = t.consult.videoLeft;
  const [state, setState] = useState<ReviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
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
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [appointmentId, videoCopy.reviewLoadError]);

  useEffect(() => {
    load();
  }, [load]);

  const showReview =
    state &&
    (state.canReview || state.review || state.platform?.canReview || state.platform?.review) &&
    !loading &&
    !error;

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

      {state?.prescription && !loading && !error ? (
        <div className="rounded-2xl border border-brand-light/30 bg-brand-muted/40 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {videoCopy.prescriptionTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{videoCopy.prescriptionDescription}</p>
              <Button asChild size="sm" className="mt-4 gap-1.5">
                <a
                  href={state.prescription.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {videoCopy.viewPrescription}
                </a>
              </Button>
            </div>
          </div>
        </div>
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
            platform={state.platform}
            defaultExpanded={state.canReview || Boolean(state.platform?.canReview)}
            afterVideoLeave
            onSubmitted={load}
          />
        </div>
      ) : null}

      {/* Once the patient has rated ZindagiCare, ask them to follow and share us. */}
      {state?.platform?.review && !loading && !error ? <SupportZindagiCareCard /> : null}
    </div>
  );
}

function SupportZindagiCareCard() {
  const videoCopy = useTranslations().consult.videoLeft;
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = siteConfig.url;
    const text = videoCopy.shareText;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: siteConfig.name, text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
    }
  };

  return (
    <div className="rounded-2xl border border-brand-light/30 bg-brand-muted/40 p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Heart className="h-5 w-5 fill-brand/20" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {videoCopy.supportTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{videoCopy.supportDescription}</p>
        </div>
      </div>
      <SocialLinks variant="buttons" />
      <Button type="button" variant="outline" className="mt-3 w-full gap-1.5" onClick={handleShare}>
        <Share2 className="h-4 w-4" />
        {copied ? videoCopy.linkCopied : videoCopy.shareCta}
      </Button>
    </div>
  );
}
