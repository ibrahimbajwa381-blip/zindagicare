"use client";

import { useEffect, useRef, useState } from "react";
import { X, CreditCard, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { PaymentProofModal } from "./payment-proof-modal";

export type AppointmentDetail = {
  id: string;
  type: string;
  status: string;
  scheduledStart: string;
  scheduledEnd?: string;
  isOnline?: boolean;
  patient: { name: string; phone?: string; email?: string };
  doctor: {
    id: string;
    name: string;
    specialty?: string;
    phone?: string;
    email?: string;
    avatarUrl?: string;
  };
  patientNotes?: string;
  clinic?: { hospitalName?: string; address?: string; city?: string };
  amountPkr?: number;
  paymentStatus?: string;
  paymentId?: string;
  paymentProvider?: string;
  paymentCurrency?: string;
  transactionId?: string;
  paidAt?: string;
  refundedAt?: string;
  failureReason?: string;
  receiptUploaded?: boolean;
  cancellationReason?: string;
  isReferred?: boolean;
  createdAt?: string;
  cancellationRequestStatus?: string;
  cancellationRequestReason?: string;
  cancellationRequestedAt?: string;
  refundMethod?: string;
  refundAccountTitle?: string;
  refundAccountNumber?: string;
  refundBankName?: string;
  patientJoinedAt?: string;
  doctorJoinedAt?: string;
};

const REFUND_METHOD_LABEL: Record<string, string> = {
  bank: "Bank transfer",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
};

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

export function AdminAppointmentDetailModal({
  appointment,
  onClose,
  onReferralChange,
}: {
  appointment: AppointmentDetail | null;
  onClose: () => void;
  onReferralChange?: (appointmentId: string, isReferred: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [receiptFailed, setReceiptFailed] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [referralPending, setReferralPending] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (appointment) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
      setReceiptFailed(false);
      setReferralError(null);
    } else {
      if (dialog.open) dialog.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [appointment]);

  if (!appointment) {
    return (
      <dialog ref={dialogRef} className="hidden" onClose={onClose} />
    );
  }

  const a = appointment;

  const toggleReferral = async () => {
    const nextIsReferral = !a.isReferred;
    const warning = nextIsReferral
      ? `Mark ${a.patient.name} as referred by ${a.doctor.name}? This applies the referral commission bonus to ALL of this patient's appointments with this doctor, not just this one.`
      : `Remove the referral link between ${a.patient.name} and ${a.doctor.name}? This affects ALL of their appointments, not just this one.`;
    if (!window.confirm(warning)) return;

    setReferralPending(true);
    setReferralError(null);
    try {
      const res = await fetch(`/api/v1/admin/appointments/${a.id}/referral`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReferral: nextIsReferral }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Failed to update referral status");
      }
      onReferralChange?.(a.id, Boolean(json.data?.isReferred));
    } catch (err) {
      setReferralError(err instanceof Error ? err.message : "Failed to update referral status");
    } finally {
      setReferralPending(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-900/55 backdrop:backdrop-blur-sm"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="flex h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className={`flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl shadow-premium-lg sm:rounded-3xl ${surfaceCard}`}
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          <div className="relative border-b border-slate-100 px-6 pb-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 active:scale-95"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 pr-10">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand">
                <CreditCard className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Appointment & payment details
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 capitalize">
                  {a.type.replace(/_/g, " ")} · {a.patient.name}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 overflow-y-auto px-6 py-5">
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Appointment
              </h3>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 px-3">
                <Row label="Status" value={a.status} />
                <Row label="Date & time" value={formatKarachiDateTime(a.scheduledStart)} />
                <Row
                  label="Booked at"
                  value={a.createdAt ? formatKarachiDateTime(a.createdAt) : undefined}
                />
                <Row label="Doctor" value={a.doctor.name} />
                <Row label="Specialty" value={a.doctor.specialty} />
                <Row label="Doctor phone" value={a.doctor.phone} />
                <Row label="Doctor email" value={a.doctor.email} />
                <Row label="Patient" value={a.patient.name} />
                <Row label="Patient phone" value={a.patient.phone} />
                <Row label="Patient email" value={a.patient.email} />
                <Row label="Referral" value={a.isReferred ? "Yes — referred by this doctor" : "No"} />
                {a.clinic && (
                  <Row
                    label="Clinic"
                    value={[a.clinic.hospitalName, a.clinic.address, a.clinic.city]
                      .filter(Boolean)
                      .join(", ")}
                  />
                )}
                <Row label="Notes" value={a.patientNotes} />
                {a.status === "cancelled" && (
                  <Row label="Cancellation reason" value={a.cancellationReason} />
                )}
                {a.cancellationRequestStatus && a.cancellationRequestStatus !== "none" && (
                  <>
                    <Row label="Cancellation request" value={a.cancellationRequestStatus} />
                    <Row label="Request reason" value={a.cancellationRequestReason} />
                    <Row
                      label="Requested at"
                      value={
                        a.cancellationRequestedAt
                          ? formatKarachiDateTime(a.cancellationRequestedAt)
                          : undefined
                      }
                    />
                  </>
                )}
              </div>
              <div className="mt-2 space-y-1.5">
                <button
                  type="button"
                  onClick={toggleReferral}
                  disabled={referralPending}
                  className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-sm font-medium text-brand transition-colors hover:bg-brand/10 disabled:opacity-60"
                >
                  {referralPending
                    ? "Updating…"
                    : a.isReferred
                      ? "Remove referral"
                      : "Mark as referral"}
                </button>
                {referralError && <p className="text-sm text-red-500">{referralError}</p>}
              </div>
            </section>

            {a.refundMethod && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Refund payout details
                </h3>
                <div className="divide-y divide-slate-100 rounded-xl border border-amber-100 bg-amber-50/40 px-3">
                  <Row label="Method" value={REFUND_METHOD_LABEL[a.refundMethod] ?? a.refundMethod} />
                  <Row label="Account title" value={a.refundAccountTitle} />
                  <Row
                    label={a.refundMethod === "bank" ? "Account / IBAN" : "Mobile number"}
                    value={a.refundAccountNumber}
                  />
                  {a.refundMethod === "bank" && <Row label="Bank name" value={a.refundBankName} />}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Payment
              </h3>
              {a.amountPkr === undefined ? (
                <p className="rounded-xl border border-slate-100 px-3 py-3 text-sm text-slate-500">
                  No payment record found for this appointment.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 px-3">
                  <Row
                    label="Amount"
                    value={`${a.paymentCurrency ?? "Rs."} ${a.amountPkr.toLocaleString()}`}
                  />
                  <Row label="Payment status" value={a.paymentStatus} />
                  <Row label="Provider" value={a.paymentProvider} />
                  <Row label="Transaction ID" value={a.transactionId} />
                  <Row
                    label="Paid at"
                    value={a.paidAt ? formatKarachiDateTime(a.paidAt) : undefined}
                  />
                  <Row
                    label="Refunded at"
                    value={a.refundedAt ? formatKarachiDateTime(a.refundedAt) : undefined}
                  />
                  <Row label="Failure reason" value={a.failureReason} />
                </div>
              )}
            </section>

            {a.receiptUploaded && a.paymentId && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Uploaded receipt
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 gap-2 border-slate-200 bg-slate-50 text-slate-700 hover:border-brand hover:bg-brand/5 hover:text-brand"
                  onClick={() => setShowProofModal(true)}
                >
                  <Eye className="h-4 w-4 text-brand" />
                  View Payment Proof
                </Button>

                <PaymentProofModal
                  isOpen={showProofModal}
                  paymentId={a.paymentId}
                  onClose={() => setShowProofModal(false)}
                />
              </section>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
