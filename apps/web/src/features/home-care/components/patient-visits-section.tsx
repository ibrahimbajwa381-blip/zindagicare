"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { HOME_CARE_MATCH_RADIUS_KM, HomeVisitServiceTypes } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useTranslations } from "@/i18n/locale-provider";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { VisitStatusStepper } from "./visit-status-stepper";
import {
  HomeVisitReviewSection,
  isHomeVisitReviewEligible,
} from "./home-visit-review-section";
import type { HomeVisitDto } from "@/server/services/home-visit.service";

const REFUND_STATUS_COPY: Record<string, { label: string; tone: string }> = {
  pending: { label: "Refund request pending review", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  approved: { label: "Refund approved & sent", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  denied: { label: "Refund request was denied", tone: "border-red-200 bg-red-50 text-red-800" },
};

const SERVICE_LABELS: Record<string, keyof ReturnType<typeof useTranslations>["homeCare"]["services"]> = {
  [HomeVisitServiceTypes.DOCTOR_VISIT]: "doctorVisit",
  [HomeVisitServiceTypes.NURSE]: "generalNurse",
  [HomeVisitServiceTypes.PHYSIOTHERAPY]: "physiotherapy",
  [HomeVisitServiceTypes.IV_DRIP]: "ivDrip",
  [HomeVisitServiceTypes.INJECTION]: "injection",
  [HomeVisitServiceTypes.WOUND_CARE]: "woundCare",
};

export function PatientVisitsSection() {
  const t = useTranslations();
  const h = t.homeCare;
  const reviewCopy = h.review;
  const router = useRouter();
  const [visits, setVisits] = useState<HomeVisitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/home-visits?scope=mine", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setVisits(json.data ?? []);
    } catch {
      // Keep showing the last known visits if a background refresh fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll every minute so status changes (e.g. provider marks "en route") show up
  // without a full page reload. Skip while the tab is hidden; refresh on return.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const refreshVisit = async (visitId: string) => {
    setRefreshing(visitId);
    await load();
    setRefreshing(null);
  };

  const cancelUnpaidVisit = async (visitId: string) => {
    if (!window.confirm("Cancel this request?")) return;
    setPending(visitId);
    const res = await fetch(`/api/v1/home-visits/${visitId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const json = await res.json();
    setPending(null);
    if (json.success) await load();
    else window.alert(json.error?.message ?? "Couldn't cancel. Please try again.");
  };

  if (loading) {
    return <LoadingScreen message={`${h.visitsTitle}…`} />;
  }

  if (visits.length === 0) {
    return (
      <Card className={surfaceCard}>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-slate-500">{h.noVisits}</p>
          <Button asChild className="mt-4">
            <Link href="/home-care/request">{h.bookVisit}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {visits.map((visit) => {
        const labelKey = SERVICE_LABELS[visit.serviceType];
        const serviceName = labelKey ? h.services[labelKey] : visit.serviceType;
        return (
          <Card key={visit.id} className={surfaceCard}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-base">{serviceName}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-brand-dark">
                    Rs. {visit.pricing.total.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => refreshVisit(visit.id)}
                    disabled={refreshing !== null}
                    aria-label="Refresh visit status"
                    title="Refresh status"
                    className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-brand-dark disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${refreshing === visit.id ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                {formatKarachiDateTime(visit.scheduledAt)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <VisitStatusStepper status={visit.status} compact />
              <p className="text-sm text-slate-600">{visit.address.line}</p>
              {visit.status !== "cancelled" &&
                (visit.assignedStaff ? (
                  <p className="text-sm">
                    <span className="text-slate-500">{h.assignedNurse}: </span>
                    <span className="font-medium">{visit.assignedStaff.name}</span>
                  </p>
                ) : (
                  <p className="text-sm text-amber-700">{h.pendingAssignment}</p>
                ))}
              {visit.assignedStaff &&
                (visit.status === "assigned" || visit.status === "requested") &&
                visit.pricing.distance > HOME_CARE_MATCH_RADIUS_KM && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm text-amber-800">
                    {visit.assignedStaff.name} is about {Math.round(visit.pricing.distance)} km away —
                    outside our usual {HOME_CARE_MATCH_RADIUS_KM} km home-visit area. They will
                    confirm they can travel to you, and extra travel charges may apply.
                  </p>
                )}

              {visit.paymentStatus === "paid" && (
                <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  Paid
                </span>
              )}
              {visit.cancellationRequestStatus && REFUND_STATUS_COPY[visit.cancellationRequestStatus] && (
                <p
                  className={`rounded-xl border px-3.5 py-2 text-sm ${REFUND_STATUS_COPY[visit.cancellationRequestStatus].tone}`}
                >
                  {REFUND_STATUS_COPY[visit.cancellationRequestStatus].label}
                </p>
              )}

              {visit.visitReport && (
                <Button variant="outline" size="sm" asChild>
                  <a href={visit.visitReport.url} target="_blank" rel="noopener noreferrer">
                    {h.viewReport}
                  </a>
                </Button>
              )}
              {isHomeVisitReviewEligible(visit.status) && (
                <HomeVisitReviewSection visitId={visit.id} copy={reviewCopy} />
              )}

              <div className="flex flex-wrap gap-2">
                {(visit.status === "requested" || visit.status === "assigned") &&
                  visit.paymentStatus !== "paid" && (
                    <Button size="sm" onClick={() => router.push(`/home-care/pay?visitId=${visit.id}`)}>
                      Pay now to confirm visit
                    </Button>
                  )}
                {visit.status === "requested" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending === visit.id}
                    onClick={() =>
                      visit.paymentStatus === "paid"
                        ? router.push(`/home-care/cancel-refund?visitId=${visit.id}`)
                        : cancelUnpaidVisit(visit.id)
                    }
                  >
                    Cancel request
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
