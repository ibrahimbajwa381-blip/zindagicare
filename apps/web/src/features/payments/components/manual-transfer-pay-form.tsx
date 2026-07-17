"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingInline } from "@/components/ui/loading-screen";
import type { ManualTransferCheckout } from "@/lib/payments/manual-payment";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

export type ManualTransferPayCopy = {
  title: string;
  description: string;
  loading: string;
  accountTitleLabel: string;
  accountNumberLabel: string;
  amountLabel: string;
  instructions: string;
  copyNumber: string;
  copied: string;
  uploadLabel: string;
  uploadHint: string;
  submit: string;
  submitting: string;
  cancel: string;
  missingPayment: string;
  loadError: string;
};

type Props = {
  paymentId: string | null;
  amount: number | null;
  manualTransfer: ManualTransferCheckout | null;
  loading: boolean;
  error: string | null;
  copy: ManualTransferPayCopy;
  cancelHref: string;
  onSubmitReceipt: (file: File) => Promise<void>;
  submitting: boolean;
};

export function ManualTransferPayForm({
  paymentId,
  amount,
  manualTransfer,
  loading,
  error,
  copy,
  cancelHref,
  onSubmitReceipt,
  submitting,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const account = manualTransfer?.account;
  const displayAmount = amount ?? manualTransfer?.amountPkr ?? null;

  const copyNumber = async () => {
    if (!account?.number) return;
    try {
      await navigator.clipboard.writeText(account.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setLocalError(copy.uploadHint);
      return;
    }
    setLocalError(null);
    await onSubmitReceipt(file);
  };

  return (
    <div className={`mx-auto max-w-lg space-y-5 p-6 ${surfaceCardInteractive}`}>
      {loading && <LoadingInline message={copy.loading} />}

      {!loading && manualTransfer && account && (
        <>
          <p className="rounded-xl border border-brand-light/40 bg-brand-muted/50 px-4 py-3 text-sm text-brand-dark">
            {copy.instructions}
          </p>

          <dl className="space-y-3 text-sm">
            <div className="flex flex-col gap-0.5 border-b border-slate-100 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <dt className="text-slate-500">{copy.accountTitleLabel}</dt>
              <dd className="font-semibold text-slate-900">{account.accountTitle}</dd>
            </div>
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <dt className="text-slate-500">{copy.accountNumberLabel}</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono text-base font-semibold tracking-wide text-slate-900">
                  {account.numberDisplay}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 px-2"
                  onClick={copyNumber}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? copy.copied : copy.copyNumber}
                </Button>
              </dd>
            </div>
            {displayAmount != null && (
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                <dt className="text-slate-500">{copy.amountLabel}</dt>
                <dd className="font-display text-lg font-semibold text-brand-dark">
                  Rs. {displayAmount.toLocaleString()}
                </dd>
              </div>
            )}
          </dl>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="receipt-file">
              {copy.uploadLabel}
            </label>
            <p className="text-xs text-slate-500">{copy.uploadHint}</p>
            <label
              htmlFor="receipt-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center transition-colors hover:border-brand hover:bg-brand-muted/30"
            >
              <Upload className="h-5 w-5 text-brand" />
              <span className="text-sm font-medium text-slate-700">
                {file ? file.name : copy.uploadLabel}
              </span>
              <input
                id="receipt-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                disabled={submitting}
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  setFile(next);
                  setLocalError(null);
                }}
              />
            </label>
          </div>

          {(error || localError) && (
            <p className="text-sm text-red-600">{error ?? localError}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              className="flex-1 bg-brand text-white hover:bg-brand-dark"
              disabled={submitting || !paymentId}
              loading={submitting}
              onClick={handleSubmit}
            >
              {submitting ? copy.submitting : copy.submit}
            </Button>
            <Button asChild variant="outline">
              <Link href={cancelHref}>{copy.cancel}</Link>
            </Button>
          </div>
        </>
      )}

      {!loading && !manualTransfer && (error || !paymentId) && (
        <div className="space-y-3">
          <p className="text-sm text-red-600">
            {error ?? copy.missingPayment}
          </p>
          <Button asChild variant="outline">
            <Link href={cancelHref}>{copy.cancel}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
