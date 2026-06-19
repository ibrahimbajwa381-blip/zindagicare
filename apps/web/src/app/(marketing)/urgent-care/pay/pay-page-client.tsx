"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { LoadingInline } from "@/components/ui/loading-screen";
import { siteConfig } from "@/config/site";
import type { TestPaymentCheckout } from "@/lib/payments/dummy-payment";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { useTranslations } from "@/i18n/locale-provider";

export default function UrgentPayPageClient() {
  const t = useTranslations();
  const u = t.urgentCare;
  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentId = searchParams.get("paymentId");
  const [testPayment, setTestPayment] = useState<TestPaymentCheckout | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      setError("Missing payment reference.");
      return;
    }

    let cancelled = false;

    (async () => {
      const res = await fetch(`/api/v1/payments/${paymentId}/status`);
      const json = await res.json();

      if (cancelled) return;

      if (!json.success) {
        setError(json.error?.message ?? "Could not load payment");
        setLoading(false);
        return;
      }

      if (json.data?.status === "paid") {
        router.replace(`/urgent-care/success?paymentId=${paymentId}`);
        return;
      }

      setAmount(json.data?.amount ?? null);
      setTestPayment(json.data?.testPayment ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [paymentId, router]);

  const completeTestPayment = async () => {
    if (!paymentId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/payments/test/complete?paymentId=${paymentId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Could not complete test payment");
      }
      router.push(`/urgent-care/success?paymentId=${paymentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle
          title={u.payment.title}
          description={u.payment.description}
        />
      </PageSection>
      <PageSection variant="brand" spacing="lg">
        <div className={`mx-auto max-w-xl space-y-6 p-6 ${surfaceCardInteractive}`}>
          {loading && <LoadingInline message={u.payment.loading} />}
          {!loading && testPayment && (
            <>
              <div className="rounded-xl border border-brand-light/50 bg-brand-muted/60 px-4 py-3 text-sm text-brand-dark">
                {u.payment.completeTest} — dummy gateway, no real charge.
              </div>
              <dl className="space-y-3 text-sm">
                {[
                  ["Provider", testPayment.provider],
                  ["Transaction ref", testPayment.txnRefNo],
                  ["Amount (PKR)", `Rs. ${testPayment.amountPkr.toLocaleString()}`],
                  ["Description", testPayment.description],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-col gap-0.5 border-b border-slate-100 pb-2 sm:flex-row sm:justify-between"
                  >
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-mono text-xs font-medium text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
              {amount != null && (
                <p className="text-center text-lg font-semibold text-brand-dark">
                  Total: Rs. {amount.toLocaleString()}
                </p>
              )}
              <Button
                className="w-full bg-brand hover:bg-brand-dark"
                size="lg"
                onClick={completeTestPayment}
                disabled={submitting}
              >
                {submitting ? u.payment.processing : u.payment.completeTest}
              </Button>
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button asChild variant="outline">
            <Link href={siteConfig.links.urgentCare}>{u.payment.backToUrgent}</Link>
          </Button>
        </div>
      </PageSection>
    </>
  );
}
