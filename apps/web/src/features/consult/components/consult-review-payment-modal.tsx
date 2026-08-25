"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Calendar, CreditCard, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import {
  paymentProviderLabel,
  usePaymentProviders,
} from "@/features/consult/hooks/use-payment-providers";
import { formatKarachiDate } from "@/lib/format/datetime";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { PaymentProviderInput } from "@zindagi/validators";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorName: string;
  doctorSpecialty?: string;
  doctorAvatarUrl?: string;
  consultationFee: number;
  slotStartAt?: string;
  slotFormatted: boolean;
  patientNotes: string;
  onPatientNotesChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  paymentProvider: PaymentProviderInput;
  onPaymentProviderChange: (provider: PaymentProviderInput) => void;
  onPay: () => void;
};

function DoctorAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const src = resolveDoctorPortrait(name, avatarUrl);
  if (src) {
    return (
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200">
        <Image src={src} alt={name} fill className="object-cover object-top" sizes="48px" />
      </span>
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-600">
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

export function ConsultReviewPaymentModal({
  open,
  onOpenChange,
  doctorName,
  doctorSpecialty,
  doctorAvatarUrl,
  consultationFee,
  slotStartAt,
  slotFormatted,
  patientNotes,
  onPatientNotesChange,
  loading,
  error,
  paymentProvider,
  onPaymentProviderChange,
  onPay,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { loading: providersLoading, livePaymentsEnabled, providers } = usePaymentProviders();
  const showProviderChoice = livePaymentsEnabled && providers.length > 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
    } else {
      if (dialog.open) dialog.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="consult-review-payment-dialog fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-900/55 backdrop:backdrop-blur-sm"
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === dialogRef.current && !loading) onOpenChange(false);
      }}
    >
      <div className="flex h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className={`flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl shadow-premium-lg sm:rounded-3xl ${surfaceCard}`}
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          <div className="relative border-b border-slate-100 px-6 pb-4 pt-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 active:scale-95 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 pr-10">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand">
                <CreditCard className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                  Review & pay
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Confirm your appointment details before payment
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <DoctorAvatar name={doctorName} avatarUrl={doctorAvatarUrl} />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{doctorName}</p>
                {doctorSpecialty && (
                  <p className="text-sm text-slate-500">{doctorSpecialty}</p>
                )}
              </div>
            </div>

            {slotStartAt && slotFormatted && (
              <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-white p-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Date & time
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {formatKarachiDate(slotStartAt)}
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-brand-light/30 bg-brand-muted/40 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Consultation fee</span>
                <span className="font-display text-2xl font-semibold text-brand-dark">
                  Rs. {consultationFee.toLocaleString()}
                </span>
              </div>
            </div>

            {showProviderChoice && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">Payment method</legend>
                <div className="grid grid-cols-2 gap-2">
                  {providers.map((provider) => {
                    const selected = paymentProvider === provider;
                    return (
                      <button
                        key={provider}
                        type="button"
                        disabled={loading || providersLoading}
                        onClick={() => onPaymentProviderChange(provider)}
                        className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                          selected
                            ? "border-brand bg-brand-muted text-brand-dark"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span className="font-semibold">{paymentProviderLabel(provider)}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">Mobile wallet</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Symptoms or notes (optional)</span>
              <textarea
                value={patientNotes}
                onChange={(e) => onPatientNotesChange(e.target.value)}
                maxLength={500}
                rows={3}
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                placeholder="Briefly describe your concern…"
              />
            </label>

            <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-800">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <span>
                {livePaymentsEnabled
                  ? `Secure payment via ${
                      showProviderChoice
                        ? paymentProviderLabel(paymentProvider)
                        : providers.length === 1
                          ? paymentProviderLabel(providers[0]!)
                          : "JazzCash or Easypaisa"
                    }. Your slot is held until checkout completes.`
                  : "Transfer the fee to our account. Your slot is held until payment is confirmed."}
              </span>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {loading && (
              <p className="text-center text-sm text-slate-500">Opening payment…</p>
            )}
          </div>

          <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
            <Button
              variant="outline"
              className="flex-1"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Back
            </Button>
            <Button
              variant="default"
              className="flex-1 bg-brand text-white hover:bg-brand-dark"
              disabled={loading}
              onClick={onPay}
            >
              {loading ? "Starting…" : `Pay Rs. ${consultationFee.toLocaleString()}`}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
