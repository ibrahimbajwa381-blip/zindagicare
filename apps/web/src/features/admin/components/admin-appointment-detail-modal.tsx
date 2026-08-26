"use client";

import { useEffect, useRef, useState } from "react";
import { X, CreditCard } from "lucide-react";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";

export type AppointmentDetail = {
  id: string;
  type: string;
  status: string;
  scheduledStart: string;
  scheduledEnd?: string;
  isOnline?: boolean;
  patient: { name: string; phone?: string; email?: string };
  doctor: { id: string; name: string; specialty?: string; phone?: string; email?: string };
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
}: {
  appointment: AppointmentDetail | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [receiptFailed, setReceiptFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (appointment) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
      setReceiptFailed(false);
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
                <Row label="Doctor" value={a.doctor.name} />
                <Row label="Specialty" value={a.doctor.specialty} />
                <Row label="Doctor phone" value={a.doctor.phone} />
                <Row label="Doctor email" value={a.doctor.email} />
                <Row label="Patient" value={a.patient.name} />
                <Row label="Patient phone" value={a.patient.phone} />
                <Row label="Patient email" value={a.patient.email} />
                <Row label="Referral" value={a.isReferred ? "Yes — referred by this doctor" : undefined} />
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
              </div>
            </section>

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
                {receiptFailed ? (
                  <p className="rounded-xl border border-slate-100 px-3 py-3 text-sm text-slate-500">
                    Receipt could not be loaded (patient may have provided only a transaction ID).
                  </p>
                ) : (
                  <a
                    href={`/api/v1/payments/${a.paymentId}/receipt`}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-slate-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/v1/payments/${a.paymentId}/receipt`}
                      alt="Payment receipt"
                      className="max-h-72 w-full object-contain bg-slate-50"
                      onError={() => setReceiptFailed(true)}
                    />
                  </a>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
