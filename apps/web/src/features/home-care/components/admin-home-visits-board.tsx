"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HomeVisitStatuses,
  HomeVisitServiceTypes,
  HOME_CARE_MATCH_RADIUS_KM,
  cn,
  type HomeVisitProviderKind,
} from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { PaymentProofModal } from "@/features/admin/components/payment-proof-modal";
import { dispatchAdminNavCountsRefresh } from "@/features/admin/lib/nav-counts-events";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { googleMapsLink } from "@/lib/geo/parse-google-maps-url";
import { VisitStatusStepper } from "./visit-status-stepper";
import { ADMIN_HOME_VISIT_PROVIDERS } from "../lib/admin-home-visit-providers";
import type {
  HomeVisitDto,
  VisitStaffCandidate,
  VisitStaffCandidates,
} from "@/server/services/home-visit.service";
import { Check, Copy, ExternalLink, MapPin, Phone } from "lucide-react";

type VisitStaffLists = Pick<VisitStaffCandidates, "nearby" | "all" | "radiusKm">;

const SERVICE_LABELS: Record<string, string> = {
  [HomeVisitServiceTypes.DOCTOR_VISIT]: "Doctor home visit",
  [HomeVisitServiceTypes.NURSE]: "General nurse visit",
  [HomeVisitServiceTypes.IV_DRIP]: "IV drip",
  [HomeVisitServiceTypes.INJECTION]: "Injection",
  [HomeVisitServiceTypes.WOUND_CARE]: "Wound care",
  [HomeVisitServiceTypes.PHYSIOTHERAPY]: "Physiotherapy",
};

const REFUND_METHOD_LABEL: Record<string, string> = {
  bank: "Bank transfer",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
};

const PAYMENT_STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  paid: { label: "Paid", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  pending: { label: "Payment pending", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  failed: { label: "Payment failed", tone: "border-red-200 bg-red-50 text-red-700" },
  refunded: { label: "Refunded", tone: "border-slate-200 bg-slate-50 text-slate-700" },
  cancelled: { label: "Payment cancelled", tone: "border-slate-200 bg-slate-50 text-slate-700" },
};

const ACTIVE_STATUS_HINTS: Partial<Record<string, string>> = {
  [HomeVisitStatuses.ASSIGNED]: "Assigned provider will mark en route from their visits dashboard.",
  [HomeVisitStatuses.EN_ROUTE]: "Provider is en route. They will mark arrival when they reach the patient.",
  [HomeVisitStatuses.ARRIVED]: "Provider is with the patient and will mark the visit complete when finished.",
};

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function visitElementId(visitId: string) {
  return `home-visit-${visitId}`;
}

function formatStaffOption(person: VisitStaffCandidate): string {
  const parts = [person.name];
  if (person.distanceKm !== undefined) parts.push(`${person.distanceKm.toFixed(1)} km`);
  if (person.specialties) parts.push(person.specialties.join(", ") || "General");
  parts.push(person.serviceArea);
  return parts.join(" · ");
}

type AdminHomeVisitsBoardProps = {
  /** Which provider queue this board shows; visits of other kinds are never loaded. */
  provider: HomeVisitProviderKind;
  /** Visit to scroll to and highlight, e.g. when opened from a notification. */
  focusVisitId?: string;
};

/**
 * Dispatch board for one provider's home visits. Mount with `key={provider}`
 * so switching queues starts from fresh state.
 */
export function AdminHomeVisitsBoard({ provider, focusVisitId }: AdminHomeVisitsBoardProps) {
  const config = ADMIN_HOME_VISIT_PROVIDERS[provider];
  const providerTitle = capitalize(config.providerNoun);
  const [visits, setVisits] = useState<HomeVisitDto[]>([]);
  const [staffByVisit, setStaffByVisit] = useState<Record<string, VisitStaffLists>>({});
  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>({});
  const [manualOverride, setManualOverride] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [proofPaymentId, setProofPaymentId] = useState<string | null>(null);
  const [copiedPhoneKey, setCopiedPhoneKey] = useState<string | null>(null);

  const copyPhone = async (copyKey: string, phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhoneKey(copyKey);
      setTimeout(() => {
        setCopiedPhoneKey((current) => (current === copyKey ? null : current));
      }, 2000);
    } catch {
      window.prompt("Copy the phone number:", phone);
    }
  };

  const fetchStaffForVisits = useCallback(async (visitList: HomeVisitDto[]) => {
    const assignable = visitList.filter(
      (v) => v.status === HomeVisitStatuses.REQUESTED,
    );
    const results = await Promise.all(
      assignable.map(async (visit) => {
        const res = await fetch(`/api/v1/home-visits/staff?visitId=${visit.id}`);
        const json = await res.json();
        if (!json.success) return [visit.id, null] as const;
        const data = json.data as VisitStaffCandidates;
        return [
          visit.id,
          { nearby: data.nearby, all: data.all, radiusKm: data.radiusKm },
        ] as const;
      }),
    );
    const next: Record<string, VisitStaffLists> = {};
    for (const [id, data] of results) {
      if (data) next[id] = data;
    }
    return next;
  }, []);

  // Reloads can overlap (e.g. two quick assignments); only the newest may write state.
  const loadSeqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const params = new URLSearchParams({ scope: "all", provider });
    const visitsRes = await fetch(`/api/v1/home-visits?${params}`);
    const visitsJson = await visitsRes.json();
    const list: HomeVisitDto[] = visitsJson.success ? visitsJson.data ?? [] : [];
    const staff = await fetchStaffForVisits(list);
    if (seq !== loadSeqRef.current) return;
    setVisits(list);
    setStaffByVisit(staff);
    setLoading(false);
  }, [provider, fetchStaffForVisits]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || !focusVisitId) return;
    document
      .getElementById(visitElementId(focusVisitId))
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [loading, focusVisitId]);

  const assign = async (visitId: string, auto: boolean) => {
    setPending(visitId);
    try {
      const body = auto
        ? { auto: true }
        : {
            staffId: selectedStaff[visitId],
            override: manualOverride[visitId] ?? false,
          };
      const res = await fetch(`/api/v1/home-visits/${visitId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Assignment failed");
      }
      dispatchAdminNavCountsRefresh();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setPending(null);
    }
  };

  const cancelVisit = async (visitId: string) => {
    const reason = window.prompt("Cancellation reason (optional):") ?? undefined;
    setPending(visitId);
    try {
      const res = await fetch(`/api/v1/home-visits/${visitId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: HomeVisitStatuses.CANCELLED,
          cancellationReason: reason,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Cancel failed");
      dispatchAdminNavCountsRefresh();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setPending(null);
    }
  };

  const resolveCancellationRequest = async (visitId: string, action: "approve" | "deny") => {
    if (action === "approve") {
      const confirmed = window.confirm(
        "Approve this refund request? The payment will be marked refunded.",
      );
      if (!confirmed) return;
    }
    setPending(visitId);
    try {
      const res = await fetch(`/api/v1/home-visits/${visitId}/cancellation-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Couldn't resolve the refund request");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't resolve the refund request");
    } finally {
      setPending(null);
    }
  };

  if (loading) {
    return <LoadingScreen message={`Loading ${config.providerNoun} home visits…`} />;
  }

  const pendingVisits = visits.filter((v) => v.status === HomeVisitStatuses.REQUESTED);
  const activeVisits = visits.filter(
    (v) =>
      v.status !== HomeVisitStatuses.REQUESTED &&
      v.status !== HomeVisitStatuses.COMPLETED &&
      v.status !== HomeVisitStatuses.CANCELLED,
  );
  const closedVisits = visits.filter(
    (v) =>
      v.status === HomeVisitStatuses.COMPLETED ||
      v.status === HomeVisitStatuses.CANCELLED,
  );

  function visitCardProps(visitId: string) {
    return {
      id: visitElementId(visitId),
      className: cn(
        surfaceCard,
        "scroll-mt-24",
        visitId === focusVisitId && "ring-2 ring-brand ring-offset-2",
      ),
    };
  }

  function renderAssignControls(visit: HomeVisitDto) {
    const staffLists = staffByVisit[visit.id];
    const override = manualOverride[visit.id] ?? false;
    const nearbyOptions = staffLists?.nearby ?? [];
    const allOptions = staffLists?.all ?? [];
    const options = override ? allOptions : nearbyOptions;
    const radiusKm = staffLists?.radiusKm ?? HOME_CARE_MATCH_RADIUS_KM;

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <Button
            size="sm"
            disabled={pending === visit.id || nearbyOptions.length === 0}
            onClick={() => assign(visit.id, true)}
          >
            Auto-assign nearest {config.providerNoun}
          </Button>
          <select
            className="h-9 min-w-[220px] flex-1 rounded-lg border border-border bg-white px-2 text-sm"
            value={selectedStaff[visit.id] ?? ""}
            onChange={(e) =>
              setSelectedStaff((s) => ({ ...s, [visit.id]: e.target.value }))
            }
          >
            <option value="">Select {config.providerNoun}…</option>
            {options.map((person) => (
              <option key={person.id} value={person.id}>
                {formatStaffOption(person)}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending === visit.id || !selectedStaff[visit.id]}
            onClick={() => assign(visit.id, false)}
          >
            Assign selected
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending === visit.id}
            onClick={() => cancelVisit(visit.id)}
          >
            Cancel request
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={override}
              onChange={(e) =>
                setManualOverride((s) => ({
                  ...s,
                  [visit.id]: e.target.checked,
                }))
              }
              className="rounded border-slate-300"
            />
            Assign outside {radiusKm} km radius (manual override)
          </label>
          {!override && (
            <span>
              {nearbyOptions.length} {config.providerNoun}(s) within {radiusKm} km
              {nearbyOptions.length === 0 &&
                ` — none match for ${visit.address.city}. Check the rules above, or enable override.`}
            </span>
          )}
          {override && (
            <span>
              {allOptions.length} {config.providerNoun}(s) available in total
            </span>
          )}
        </div>
      </div>
    );
  }

  /** Patient and assigned provider side by side, each with name and phone. */
  function renderContacts(visit: HomeVisitDto) {
    const staff = visit.assignedStaff;
    return (
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Patient
          </p>
          <p className="text-sm font-semibold text-slate-900">
            {visit.patient?.name ?? "Unknown patient"}
          </p>
          {renderPhone(visit.id, visit.patient?.phone)}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {providerTitle}
            {staff && visit.preferredStaff?.id === staff.id ? " · chosen by patient" : ""}
          </p>
          <p className="text-sm font-semibold text-slate-900">
            {staff?.name ?? "Unassigned"}
          </p>
          {staff?.specialties?.length ? (
            <p className="text-xs text-slate-500">{staff.specialties.join(", ")}</p>
          ) : null}
          {staff && renderPhone(`${visit.id}:staff`, staff.phone)}
        </div>
      </div>
    );
  }

  function renderPhone(copyKey: string, phone: string | undefined) {
    if (!phone) {
      return <p className="text-xs text-slate-500">Phone: not provided</p>;
    }
    const copied = copiedPhoneKey === copyKey;
    return (
      <div className="flex items-center gap-2">
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800 hover:text-brand hover:underline"
        >
          <Phone className="h-3.5 w-3.5" />
          {phone}
        </a>
        <button
          type="button"
          onClick={() => copyPhone(copyKey, phone)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          title="Copy phone number"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
    );
  }

  function renderPaymentProof(visit: HomeVisitDto) {
    const badge = PAYMENT_STATUS_BADGE[visit.paymentStatus ?? ""] ?? {
      label: "Not paid yet",
      tone: "border-slate-200 bg-slate-50 text-slate-600",
    };
    const receipt = visit.paymentReceipt;
    const paymentId = visit.paymentId;

    return (
      <div className="mt-2 flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        {paymentId && receipt?.hasImage ? (
          <button
            type="button"
            onClick={() => setProofPaymentId(paymentId)}
            className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white"
            title="View payment screenshot"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/v1/payments/${paymentId}/receipt`}
              alt="Payment screenshot"
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ) : null}
        <div className="min-w-0 space-y-1 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-800">
              Payment · Rs. {visit.pricing.total.toLocaleString()}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.tone}`}>
              {badge.label}
            </span>
          </div>
          {receipt?.transactionId && (
            <p>
              TID: <span className="font-mono text-slate-800">{receipt.transactionId}</span>
            </p>
          )}
          {receipt?.uploadedAt && (
            <p>Receipt uploaded {formatKarachiDateTime(receipt.uploadedAt)}</p>
          )}
          {paymentId && receipt?.hasImage ? (
            <button
              type="button"
              onClick={() => setProofPaymentId(paymentId)}
              className="font-medium text-brand hover:underline"
            >
              View payment screenshot
            </button>
          ) : (
            <p className="text-amber-700">Patient hasn&apos;t uploaded a payment screenshot yet.</p>
          )}
        </div>
      </div>
    );
  }

  function renderPatientLocation(visit: HomeVisitDto) {
    const { geo } = visit.address;
    const mapsUrl = googleMapsLink(geo);
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
      >
        <MapPin className="h-3.5 w-3.5" />
        View patient on Google Maps
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <div className="space-y-6">
      <PaymentProofModal
        paymentId={proofPaymentId}
        isOpen={proofPaymentId !== null}
        onClose={() => setProofPaymentId(null)}
        title="Home visit payment screenshot"
      />

      <div className="rounded-xl border border-brand/15 bg-brand-muted/30 p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">How {config.providerNoun} dispatch works</p>
        <p className="mt-1">
          By default, only {config.providerNounPlural} within {HOME_CARE_MATCH_RADIUS_KM} km of
          the patient&apos;s Google Maps pin appear in the dropdown. Use auto-assign for the
          closest match, pick from the list, or enable manual override to assign outside the
          radius. After assignment, the {config.providerNoun} updates en route, arrived, and
          completed status from their visits dashboard.
        </p>

        <div className="mt-4 rounded-lg border border-slate-200/80 bg-white/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Who appears in the list
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
            {config.eligibilityRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </div>

      {visits.length === 0 && (
        <Card className={surfaceCard}>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            No {config.providerNoun} home visits yet.
          </CardContent>
        </Card>
      )}

      {pendingVisits.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pending assignment ({pendingVisits.length})
          </h2>
          <div className="space-y-4">
            {pendingVisits.map((visit) => (
              <Card key={visit.id} {...visitCardProps(visit.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {SERVICE_LABELS[visit.serviceType] ?? visit.serviceType}
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    {visit.patient?.name} · {formatKarachiDateTime(visit.scheduledAt)}
                  </p>
                  <p className="text-sm text-slate-600">{visit.address.line}</p>
                  <p className="text-xs text-slate-500">
                    Visit city: <span className="font-medium text-slate-700">{visit.address.city}</span>
                  </p>
                  {renderPhone(visit.id, visit.patient?.phone)}
                  {renderPatientLocation(visit)}
                  {visit.preferredStaff && (
                    <p className="text-xs text-amber-700">
                      Patient chose{" "}
                      <span className="font-semibold">{visit.preferredStaff.name}</span> — they
                      couldn&apos;t be auto-assigned (likely booked at this time).
                    </p>
                  )}
                  {visit.patientNotes && (
                    <p className="text-xs text-slate-500">Notes: {visit.patientNotes}</p>
                  )}
                  {renderPaymentProof(visit)}
                </CardHeader>
                <CardContent>{renderAssignControls(visit)}</CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {activeVisits.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Active visits ({activeVisits.length})
          </h2>
          <div className="space-y-4">
            {activeVisits.map((visit) => (
              <Card key={visit.id} {...visitCardProps(visit.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {SERVICE_LABELS[visit.serviceType] ?? visit.serviceType}
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    {formatKarachiDateTime(visit.scheduledAt)}
                  </p>
                  {renderContacts(visit)}
                  {renderPatientLocation(visit)}
                  {renderPaymentProof(visit)}
                </CardHeader>
                <CardContent className="space-y-3">
                  <VisitStatusStepper status={visit.status} compact />
                  {ACTIVE_STATUS_HINTS[visit.status] && (
                    <p className="text-sm text-slate-600">
                      {ACTIVE_STATUS_HINTS[visit.status]}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending === visit.id}
                    onClick={() => cancelVisit(visit.id)}
                  >
                    Cancel visit
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {closedVisits.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Completed & cancelled
          </h2>
          <div className="space-y-4">
            {closedVisits.map((visit) => (
              <Card key={visit.id} {...visitCardProps(visit.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {SERVICE_LABELS[visit.serviceType] ?? visit.serviceType}
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    {formatKarachiDateTime(visit.scheduledAt)}
                  </p>
                  {renderContacts(visit)}
                </CardHeader>
                <CardContent className="space-y-3">
                  <VisitStatusStepper status={visit.status} compact />

                  {visit.cancellationRequestStatus === "pending" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                      <p className="text-sm font-medium text-amber-700">
                        Patient requested a refund for this cancelled visit
                      </p>
                      {visit.refundMethod && (
                        <p className="mt-1 text-xs text-amber-700/90">
                          Send to: {REFUND_METHOD_LABEL[visit.refundMethod] ?? visit.refundMethod} ·{" "}
                          {visit.refundAccountTitle} · {visit.refundAccountNumber}
                          {visit.refundMethod === "bank" && visit.refundBankName
                            ? ` (${visit.refundBankName})`
                            : ""}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          disabled={pending === visit.id}
                          onClick={() => resolveCancellationRequest(visit.id, "approve")}
                        >
                          Approve + refund
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending === visit.id}
                          onClick={() => resolveCancellationRequest(visit.id, "deny")}
                        >
                          Deny request
                        </Button>
                      </div>
                    </div>
                  )}
                  {visit.cancellationRequestStatus === "approved" && (
                    <p className="text-sm text-emerald-700">Refund approved and sent.</p>
                  )}
                  {visit.cancellationRequestStatus === "denied" && (
                    <p className="text-sm text-red-600">Refund request denied.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
