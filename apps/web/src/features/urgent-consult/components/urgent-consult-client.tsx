"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { JazzCashRedirectForm } from "@/features/consult/components/jazzcash-redirect-form";
import {
  paymentProviderLabel,
  usePaymentProviders,
} from "@/features/consult/hooks/use-payment-providers";
import type { PaymentProviderInput } from "@zindagi/validators";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  ShieldAlert,
  Video,
  Zap,
} from "lucide-react";
import { URGENT_CONSULT_CONFIG, UrgentCareRequestStatuses } from "@zindagi/shared";
import { PatientUrgentRequestCard } from "./patient-urgent-booking-card";
import { PatientUrgentCareHistory } from "./patient-consult-visits-history";
import { useUrgentRealtime } from "../hooks/use-urgent-realtime";
import type { UrgentCheckoutResult, UrgentPatientRequestDto } from "../types";

export function UrgentConsultClient() {
  const t = useTranslations();
  const u = t.urgentCare;
  const { data: session, status } = useSession();
  const [request, setRequest] = useState<UrgentPatientRequestDto | null>(null);
  const [patientPhone, setPatientPhone] = useState("");
  const [patientNotes, setPatientNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { defaultProvider, livePaymentsEnabled, providers } = usePaymentProviders();
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderInput>(defaultProvider);
  const [gatewayRedirect, setGatewayRedirect] = useState<
    UrgentCheckoutResult["gatewayRedirect"] | null
  >(null);

  useEffect(() => {
    setPaymentProvider(defaultProvider);
  }, [defaultProvider]);

  const loadMyRequest = useCallback(async () => {
    if (!session?.user) return;
    const res = await fetch("/api/v1/urgent/my-booking");
    const json = await res.json();
    if (json.success && json.data) {
      setRequest(json.data as UrgentPatientRequestDto);
    } else {
      setRequest(null);
    }
  }, [session?.user]);

  const loadProfilePhone = useCallback(async () => {
    if (!session?.user) return;
    const res = await fetch("/api/v1/patient/profile");
    const json = await res.json();
    if (json.success && json.data?.user?.phone && !patientPhone) {
      setPatientPhone(json.data.user.phone);
    }
  }, [session?.user, patientPhone]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadMyRequest();
    loadProfilePhone();
  }, [loadMyRequest, loadProfilePhone, status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#request") {
      document.getElementById("request")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useUrgentRealtime(session?.user?.id ?? null, request?.requestId ?? null, () => {
    loadMyRequest();
  });

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    const phone = patientPhone.trim();
    if (!phone) {
      setError(u.errors.phoneRequired);
      return;
    }

    if (status !== "authenticated") {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`${siteConfig.links.urgentCare}#request`)}`;
      return;
    }

    setLoading(true);
    setError(null);
    setGatewayRedirect(null);

    try {
      const res = await fetch("/api/v1/urgent/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientPhone: phone,
          patientNotes: patientNotes.trim() || undefined,
          paymentProvider,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? u.errors.checkoutFailed);
      }

      const checkout = json.data as UrgentCheckoutResult;

      const payUrl =
        checkout.manualTransfer?.payUrl ?? checkout.testPayment?.completeUrl;
      if (payUrl) {
        window.location.href = payUrl;
        return;
      }

      const redirect = checkout.gatewayRedirect ?? checkout.jazzcash;
      if (redirect) {
        setGatewayRedirect(redirect);
        return;
      }

      window.location.href = `/urgent-care/pay?paymentId=${checkout.paymentId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : u.errors.checkoutFailed);
    } finally {
      setLoading(false);
    }
  };

  const b = u.booking;
  const hasActiveRequest =
    request?.status === UrgentCareRequestStatuses.REQUESTED ||
    request?.status === UrgentCareRequestStatuses.ASSIGNED;
  const hasPastRequest =
    request?.status === UrgentCareRequestStatuses.COMPLETED ||
    request?.status === UrgentCareRequestStatuses.CANCELLED;
  const showForm = !hasActiveRequest && !gatewayRedirect;
  const showProviderChoice = livePaymentsEnabled && providers.length > 1;
  const isMatching =
    hasActiveRequest &&
    request.status === UrgentCareRequestStatuses.REQUESTED &&
    !request.doctor;

  return (
    <PageSection id="request" variant="neutral" spacing="default" flipBlur>
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-dark">
            <Zap className="h-4 w-4" aria-hidden />
            {u.shortName}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {u.pageTitle}
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">{u.pageDescription}</p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-brand-dark">
            <CreditCard className="h-4 w-4 text-brand" aria-hidden />
            {u.feeLabel.replace("{amount}", URGENT_CONSULT_CONFIG.defaultFeePkr.toLocaleString())}
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500">
            <Clock className="h-4 w-4 text-brand" aria-hidden />
            {u.waitBadge
              .replace("{min}", String(URGENT_CONSULT_CONFIG.minWaitMinutes))
              .replace("{max}", String(URGENT_CONSULT_CONFIG.maxWaitMinutes))}
          </p>
        </div>

        {gatewayRedirect && (
          <JazzCashRedirectForm
            actionUrl={gatewayRedirect.actionUrl}
            fields={gatewayRedirect.fields}
          />
        )}

        {showForm ? (
          <Card
            className={`overflow-hidden border-brand-light/40 shadow-premium ${hasPastRequest ? "mt-4" : "mt-6"}`}
          >
            <CardContent className="p-5 sm:p-6">
              {hasPastRequest || status === "authenticated" ? (
                <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
                  {u.bookAgainTitle}
                </h2>
              ) : null}
              <form onSubmit={submitRequest} className="space-y-5">
                <div>
                  <label htmlFor="urgent-phone" className="block text-sm font-semibold text-slate-800">
                    {u.phoneLabel}
                  </label>
                  <Input
                    id="urgent-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    placeholder={t.auth.phonePlaceholder}
                    className="mt-2 h-12 rounded-xl text-base"
                    required
                  />
                  <p className="mt-1.5 text-xs text-slate-500">{u.phoneHint}</p>
                </div>

                <div>
                  <label htmlFor="urgent-notes" className="block text-sm font-semibold text-slate-800">
                    {u.symptomsLabel}{" "}
                    <span className="font-normal text-slate-400">({u.optionalLabel})</span>
                  </label>
                  <textarea
                    id="urgent-notes"
                    rows={3}
                    value={patientNotes}
                    onChange={(e) => setPatientNotes(e.target.value)}
                    placeholder={u.symptomsPlaceholder}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light/30"
                    maxLength={1000}
                  />
                </div>

                {showProviderChoice && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold text-slate-800">Payment method</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {providers.map((provider) => {
                        const selected = paymentProvider === provider;
                        return (
                          <button
                            key={provider}
                            type="button"
                            disabled={loading}
                            onClick={() => setPaymentProvider(provider)}
                            className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                              selected
                                ? "border-brand bg-brand-muted text-brand-dark"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <span className="font-semibold">{paymentProviderLabel(provider)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-xl bg-brand text-base font-semibold text-white shadow-premium hover:bg-brand-dark"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      {u.requesting}
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      {u.requestCta}
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-slate-500">{u.formFootnote}</p>
                {status !== "authenticated" && (
                  <p className="text-center text-xs text-slate-500">{u.loginHint}</p>
                )}
              </form>
            </CardContent>
          </Card>
        ) : hasActiveRequest && request ? (
          <div className="mt-6 space-y-4">
            {isMatching ? (
              <div className="rounded-2xl border-2 border-brand/40 bg-gradient-to-b from-brand-muted/80 to-white px-6 py-8 text-center shadow-premium">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/15">
                  <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
                </span>
                <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  {u.successTitle}
                </p>
                <h2 className="mt-3 font-display text-2xl font-bold text-brand-dark sm:text-3xl">
                  {b.matchingTitle}
                </h2>
                <p className="mx-auto mt-3 max-w-md text-base font-medium leading-relaxed text-slate-700 sm:text-lg">
                  {b.matchingBody}
                </p>
                <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl border border-brand-light/50 bg-white px-4 py-3 text-sm shadow-sm">
                  <Video className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <span className="text-slate-600">{b.matchingVideoHint}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-5 py-4 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden />
                <p className="mt-2 text-base font-semibold text-emerald-900">{u.successTitle}</p>
                <p className="mt-1 text-sm text-emerald-800/90">{u.successBody}</p>
              </div>
            )}

            <PatientUrgentRequestCard request={request} variant="page" hideMatchingBanner />

            {session?.user ? (
              <div className="text-center">
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href={siteConfig.links.dashboard}>{b.viewDashboard}</Link>
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {status === "authenticated" ? <PatientUrgentCareHistory /> : null}

        <div className="mt-8 rounded-2xl border border-brand-light/35 bg-brand-muted/25 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-brand-dark">{u.howItWorksTitle}</h2>
          <ol className="mt-4 space-y-3">
            {u.guide.map((line, index) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand-dark">
                  {index + 1}
                </span>
                <span className="pt-0.5">{line}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Clock className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            {u.waitTime}: {URGENT_CONSULT_CONFIG.minWaitMinutes}–{URGENT_CONSULT_CONFIG.maxWaitMinutes}{" "}
            min
          </p>
          <ul className="mt-4 space-y-2 border-t border-brand-light/25 pt-4">
            {u.rules.map((rule) => (
              <li key={rule} className="flex gap-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                {rule}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-xl border border-amber-200/60 bg-amber-50/80 px-4 py-3">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            <p className="text-xs font-medium text-amber-900 sm:text-sm">{u.disclaimerBody}</p>
          </div>
        </div>
      </div>
    </PageSection>
  );
}
