"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { siteConfig } from "@/config/site";
import {
  ManualTransferPayForm,
  type ManualTransferPayCopy,
} from "@/features/payments/components/manual-transfer-pay-form";
import type { ManualTransferCheckout } from "@/lib/payments/manual-payment";
import { useTranslations } from "@/i18n/locale-provider";

export default function ConsultManualPaymentPage() {
  const t = useTranslations();
  const p = t.payment.manual;
  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentId = searchParams.get("paymentId");
  const [manualTransfer, setManualTransfer] = useState<ManualTransferCheckout | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      setError(p.missingPayment);
      return;
    }

    let cancelled = false;

    (async () => {
      const res = await fetch(`/api/v1/payments/${paymentId}/status`);
      const json = await res.json();

      if (cancelled) return;

      if (!json.success) {
        setError(json.error?.message ?? p.loadError);
        setLoading(false);
        return;
      }

      if (json.data?.status === "paid") {
        router.replace(`/doctors/booking/success?paymentId=${paymentId}`);
        return;
      }

      setAmount(json.data?.amount ?? null);
      setManualTransfer(json.data?.manualTransfer ?? null);
      if (!json.data?.manualTransfer) {
        setError(p.loadError);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [paymentId, router, p.missingPayment, p.loadError]);

  const submitReceipt = async (proof: {
    file?: File;
    transactionId?: string;
  }) => {
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
        throw new Error(json.error?.message ?? p.submitError);
      }
      router.push(`/doctors/booking/success?paymentId=${paymentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : p.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  const copy: ManualTransferPayCopy = {
    title: p.title,
    description: p.description,
    loading: p.loading,
    accountTitleLabel: p.accountTitle,
    accountNumberLabel: p.accountNumber,
    amountLabel: p.amount,
    instructions: p.instructions,
    copyNumber: p.copyNumber,
    copied: p.copied,
    uploadLabel: p.uploadReceipt,
    uploadHint: p.uploadHint,
    tidLabel: p.tidLabel,
    tidPlaceholder: p.tidPlaceholder,
    tidHint: p.tidHint,
    proofRequired: p.proofRequired,
    submit: p.submit,
    submitting: p.submitting,
    cancel: p.backToDoctors,
    missingPayment: p.missingPayment,
    loadError: p.loadError,
  };

  return (
    <>
      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle title={p.title} description={p.description} />
      </PageSection>
      <PageSection variant="brand" spacing="lg">
        <ManualTransferPayForm
          paymentId={paymentId}
          amount={amount}
          manualTransfer={manualTransfer}
          loading={loading}
          error={error}
          copy={copy}
          cancelHref={siteConfig.links.doctors}
          onSubmitReceipt={submitReceipt}
          submitting={submitting}
        />
      </PageSection>
    </>
  );
}
