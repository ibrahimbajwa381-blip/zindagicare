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

export default function ConsultTestPaymentPage() {
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
        router.replace(`/doctors/booking/success?paymentId=${paymentId}`);
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
      router.push(`/doctors/booking/success?paymentId=${paymentId}`);
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
          title="Test payment (MVP)"
          description="Simulated checkout for development. Real JazzCash will be enabled before launch."
        />
      </PageSection>
      <PageSection variant="brand" spacing="lg">
        <div className={`mx-auto max-w-lg space-y-5 p-6 ${surfaceCardInteractive}`}>
          {loading && <LoadingInline message="Loading payment details…" />}

          {testPayment && (
            <>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                Dummy gateway record — no real charge. Fields below mirror what JazzCash will use
                later.
              </div>

              <dl className="space-y-3 text-sm">
                {[
                  ["Provider", testPayment.provider],
                  ["Merchant ID", testPayment.merchantId],
                  ["Transaction ref", testPayment.txnRefNo],
                  ["Amount (PKR)", `Rs. ${testPayment.amountPkr.toLocaleString()}`],
                  ["Amount (paisa)", testPayment.amountPaisa],
                  ["Currency", testPayment.currency],
                  ["Bill reference", testPayment.billReference],
                  ["Description", testPayment.description],
                  ["Response code", testPayment.responseCode],
                  ["Secure hash", testPayment.secureHash],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-col gap-0.5 border-b border-slate-100 pb-2 sm:flex-row sm:justify-between"
                  >
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-mono text-xs font-medium text-slate-800 sm:max-w-[60%] sm:text-right">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {amount != null && (
                <p className="text-center text-lg font-semibold text-brand-dark">
                  Total: Rs. {amount.toLocaleString()}
                </p>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex flex-wrap gap-3">
                <Button
                  className="flex-1 bg-brand text-white hover:bg-brand-dark"
                  disabled={submitting}
                  loading={submitting}
                  onClick={completeTestPayment}
                >
                  {submitting ? "Confirming…" : "Complete test payment"}
                </Button>
                <Button asChild variant="outline">
                  <Link href={siteConfig.links.doctors}>Cancel</Link>
                </Button>
              </div>
            </>
          )}

          {!loading && !testPayment && error && (
            <div className="space-y-3">
              <p className="text-sm text-red-600">{error}</p>
              <Button asChild variant="outline">
                <Link href={siteConfig.links.doctors}>Back to doctors</Link>
              </Button>
            </div>
          )}
        </div>
      </PageSection>
    </>
  );
}
