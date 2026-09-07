"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ManualTransferPayForm,
  type ManualTransferPayCopy,
} from "@/features/payments/components/manual-transfer-pay-form";
import type { ManualTransferCheckout } from "@/lib/payments/manual-payment";

const copy: ManualTransferPayCopy = {
  title: "Pay for your home visit",
  description: "Transfer the amount below via JazzCash, then upload your receipt.",
  loading: "Loading payment details…",
  accountTitleLabel: "Account title",
  accountNumberLabel: "Account number",
  amountLabel: "Amount due",
  instructions: "Transfer the amount to the account below, then upload your receipt screenshot.",
  copyNumber: "Copy",
  copied: "Copied",
  uploadLabel: "Upload receipt screenshot",
  uploadHint: "A photo or screenshot of your JazzCash transfer confirmation.",
  tidLabel: "JazzCash TID (optional)",
  tidPlaceholder: "Enter JazzCash TID",
  tidHint: "Add the JazzCash transaction ID if you have it, in addition to the receipt above.",
  proofRequired: "Please upload your receipt screenshot to confirm payment.",
  submit: "Submit receipt",
  submitting: "Submitting…",
  cancel: "Back to home visits",
  missingPayment: "We couldn't find this home visit.",
  loadError: "Couldn't load payment details. Please try again.",
};

export default function HomeCarePayClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visitId");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [manualTransfer, setManualTransfer] = useState<ManualTransferCheckout | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visitId) {
      setLoading(false);
      setError(copy.missingPayment);
      return;
    }

    let cancelled = false;

    (async () => {
      const res = await fetch(`/api/v1/home-visits/${visitId}/checkout`, { method: "POST" });
      const json = await res.json();

      if (cancelled) return;

      if (!json.success) {
        setError(json.error?.message ?? copy.loadError);
        setLoading(false);
        return;
      }

      setPaymentId(json.data?.paymentId ?? null);
      setAmount(json.data?.amount ?? null);
      setManualTransfer(json.data?.manualTransfer ?? null);
      if (!json.data?.manualTransfer) {
        setError(copy.loadError);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [visitId]);

  const submitReceipt = async (proof: { file?: File; transactionId?: string }) => {
    if (!paymentId) return;
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      if (proof.file) formData.append("file", proof.file);
      if (proof.transactionId) formData.append("transactionId", proof.transactionId);
      const res = await fetch(`/api/v1/payments/${paymentId}/receipt`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Couldn't submit your receipt. Please try again.");
      }
      router.push("/home-care/visits");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit your receipt. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ManualTransferPayForm
      paymentId={paymentId}
      amount={amount}
      manualTransfer={manualTransfer}
      loading={loading}
      error={error}
      copy={copy}
      cancelHref="/home-care/visits"
      onSubmitReceipt={submitReceipt}
      submitting={submitting}
    />
  );
}
