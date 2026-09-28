"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Clock, Gift, Video } from "lucide-react";
import {
  AppointmentStatuses,
  SundayAffordabilityChoices,
  SundayFreeRequestStatuses,
  SUNDAY_CONSULT_CONFIG,
  PAID_ONLINE_INTAKE_QUESTION_KEYS,
  cn,
  type SundayAffordabilityChoice,
} from "@zindagi/shared";
import { PageSection } from "@/components/layout/page-section";
import { SundayExplainer } from "./sunday-explainer";
import { formatNextSundayLong, isSundayBookingOpenNow } from "@/lib/sunday/display";
import { useOptionalLocale, useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { siteConfig } from "@/config/site";
import { PatientSundayBookingCard } from "./patient-sunday-booking-card";
import { SundayMatchingStatus } from "./sunday-matching-status";
import { SundayHistoryFields } from "./sunday-history-fields";
import type {
  SundayPatientBookingDto,
  SundayPatientRequestDto,
  SundaySubmitRequestResult,
} from "../types";
import {
  AppointmentConfirmationModal,
  type AppointmentConfirmationDetails,
} from "@/features/consult/components/appointment-confirmation-modal";

const REQUEST_CALLBACK = `${siteConfig.links.sundayConsult}#request`;
const LOGIN_HREF = `/login?callbackUrl=${encodeURIComponent(REQUEST_CALLBACK)}`;
const REGISTER_HREF = `${siteConfig.links.register}?callbackUrl=${encodeURIComponent(REQUEST_CALLBACK)}`;

function requestToBooking(request: SundayPatientRequestDto): SundayPatientBookingDto {
  if (request.status === SundayFreeRequestStatuses.REQUESTED || !request.doctor) {
    return {
      appointmentId: request.appointmentId ?? request.requestId,
      scheduledStart: request.createdAt,
      scheduledEnd: new Date(
        new Date(request.createdAt).getTime() +
          SUNDAY_CONSULT_CONFIG.matchWithinMinutes * 60_000,
      ).toISOString(),
      status: AppointmentStatuses.PENDING,
      sundayDateKey: request.sundayDateKey,
      doctor: {
        doctorId: "",
        name: "Matching doctor…",
        specialty: "Sunday Free Consult",
        pmdcVerified: true,
        ratingAvg: 0,
        ratingCount: 0,
      },
      requestId: request.requestId,
      requestStatus: request.status,
    };
  }

  const status =
    request.appointmentStatus ??
    (request.status === SundayFreeRequestStatuses.COMPLETED
      ? AppointmentStatuses.COMPLETED
      : request.status === SundayFreeRequestStatuses.CANCELLED
        ? AppointmentStatuses.CANCELLED
        : AppointmentStatuses.CONFIRMED);

  return {
    appointmentId: request.appointmentId ?? request.requestId,
    scheduledStart: request.scheduledStart ?? request.assignedAt ?? request.createdAt,
    scheduledEnd:
      request.scheduledEnd ??
      new Date(
        new Date(request.scheduledStart ?? request.assignedAt ?? request.createdAt).getTime() +
          SUNDAY_CONSULT_CONFIG.matchWithinMinutes * 60_000,
      ).toISOString(),
    status,
    sundayDateKey: request.sundayDateKey,
    doctor: request.doctor,
    requestId: request.requestId,
    requestStatus: request.status,
  };
}

function scrollToRequest() {
  document.getElementById("request")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SundayConsultClient() {
  const { sunday: sundayCopy, dashboard: dashboardCopy } = useTranslations();
  const locale = useOptionalLocale();
  const { data: session, status } = useSession();
  const [booking, setBooking] = useState<SundayPatientBookingDto | null>(null);
  const [patientPhone, setPatientPhone] = useState("");
  const [history, setHistory] = useState<Record<string, string>>({});
  const [showHistoryErrors, setShowHistoryErrors] = useState(false);
  const [affordabilityChoice, setAffordabilityChoice] =
    useState<SundayAffordabilityChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationDetails, setConfirmationDetails] =
    useState<AppointmentConfirmationDetails | null>(null);

  const bookingOpen = isSundayBookingOpenNow();
  const isAuthenticated = status === "authenticated";
  const isGuest = status === "unauthenticated";
  const fee = SUNDAY_CONSULT_CONFIG.contributionFeePkr;

  const loadMyRequest = useCallback(async () => {
    if (!session?.user) return;
    const res = await fetch("/api/v1/sunday/request");
    const json = await res.json();
    if (json.success && json.data) {
      setBooking(requestToBooking(json.data as SundayPatientRequestDto));
    } else {
      const fallback = await fetch("/api/v1/sunday/my-booking");
      const fallbackJson = await fallback.json();
      if (fallbackJson.success && fallbackJson.data) {
        setBooking(fallbackJson.data as SundayPatientBookingDto);
      }
    }
  }, [session?.user]);

  const loadProfilePhone = useCallback(async () => {
    if (!session?.user) return;
    const res = await fetch("/api/v1/patient/profile");
    const json = await res.json();
    if (json.success && json.data?.user?.phone) {
      setPatientPhone((prev) => prev || json.data.user.phone);
    }
  }, [session?.user]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadMyRequest();
    loadProfilePhone();
  }, [loadMyRequest, loadProfilePhone, status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash === "#request" || hash === "#how-it-works") {
      const timer = window.setTimeout(scrollToRequest, 50);
      return () => window.clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    if (!booking?.requestId || booking.requestStatus !== SundayFreeRequestStatuses.REQUESTED) {
      return;
    }
    const timer = window.setInterval(() => {
      loadMyRequest();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [booking?.requestId, booking?.requestStatus, loadMyRequest]);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      window.location.href = LOGIN_HREF;
      return;
    }

    const phone = patientPhone.trim();
    if (!phone) {
      setError(sundayCopy.errors.phoneRequired);
      return;
    }

    const historyComplete = PAID_ONLINE_INTAKE_QUESTION_KEYS.every(
      (key) => (history[key] ?? "").trim().length > 0,
    );
    if (!historyComplete) {
      setShowHistoryErrors(true);
      setError(sundayCopy.errors.historyRequired);
      return;
    }

    if (!affordabilityChoice) {
      setError(
        sundayCopy.errors.affordabilityRequired ?? sundayCopy.affordabilityRequired,
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/sunday/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientPhone: phone,
          history: PAID_ONLINE_INTAKE_QUESTION_KEYS.map((key) => ({
            key,
            answer: (history[key] ?? "").trim(),
          })),
          locale: locale === "ur" ? "ur" : "en",
          affordabilityChoice,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? sundayCopy.errors.requestFailed);
      }

      const result = json.data as SundaySubmitRequestResult;

      if (result.kind === "payment") {
        const payUrl =
          result.manualTransfer?.payUrl ??
          `/sunday-consult/pay?paymentId=${result.paymentId}`;
        window.location.href = payUrl;
        return;
      }

      const request = result as SundayPatientRequestDto & { kind: "request" };
      const nextBooking = requestToBooking(request);
      setBooking(nextBooking);

      if (request.status === SundayFreeRequestStatuses.ASSIGNED && request.doctor) {
        setConfirmationDetails({
          doctorName: request.doctor.name,
          doctorSpecialty: request.doctor.specialty,
          scheduledStart: request.scheduledStart ?? request.assignedAt ?? request.createdAt,
          scheduledEnd:
            request.scheduledEnd ??
            new Date(
              new Date(request.scheduledStart ?? request.createdAt).getTime() +
                SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins * 60_000,
            ).toISOString(),
          type: "sunday",
          appointmentId: request.appointmentId ?? request.requestId,
        });
        setConfirmationOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : sundayCopy.errors.requestFailed);
    } finally {
      setLoading(false);
    }
  };

  const isMatching =
    booking?.requestStatus === SundayFreeRequestStatuses.REQUESTED ||
    (booking?.status === AppointmentStatuses.PENDING && !booking.doctor?.doctorId);

  return (
    <>
      <AppointmentConfirmationModal
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        details={confirmationDetails}
      />
      <PageSection id="request" variant="neutral" spacing="default" flipBlur>
        <div className="mx-auto max-w-xl">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-dark">
              <Gift className="h-4 w-4" aria-hidden />
              {sundayCopy.shortName}
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-foreground sm:text-3xl">
              {sundayCopy.requestTitle}
            </h1>
            <p className="mt-3 text-sm text-slate-600 sm:text-base">
              {sundayCopy.requestDescription}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700">
              {formatNextSundayLong()}
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500">
              <Clock className="h-4 w-4 text-brand" aria-hidden />
              {sundayCopy.waitBadge.replace(
                "{minutes}",
                String(SUNDAY_CONSULT_CONFIG.matchWithinMinutes),
              )}
            </p>
          </div>

          {booking && (
            <Card className="mt-6 border-brand-light/40 bg-brand-muted/60 shadow-premium">
              <CardContent className="p-5 sm:p-6">
                <p className="mb-4 font-display text-lg font-semibold text-foreground">
                  {isMatching
                    ? sundayCopy.matchingTitle
                    : dashboardCopy.sundayBooking.title}
                </p>
                {isMatching ? (
                  <SundayMatchingStatus />
                ) : (
                  <PatientSundayBookingCard booking={booking} variant="dashboard" />
                )}
              </CardContent>
            </Card>
          )}

          {!booking && (
            <Card className="mt-6 overflow-hidden border-brand-light/40 shadow-premium">
              <CardContent className="p-5 sm:p-6">
                {!bookingOpen ? (
                  <div className="space-y-3 text-center text-sm text-slate-600">
                    <p className="font-medium text-slate-800">{sundayCopy.closedTitle}</p>
                    <p>{sundayCopy.closedMessage}</p>
                  </div>
                ) : status === "loading" ? (
                  <div className="flex justify-center py-8">
                    <Spinner size="md" />
                  </div>
                ) : isGuest ? (
                  <div className="space-y-4 text-center">
                    <p className="text-sm text-slate-600">{sundayCopy.loginGateMessage}</p>
                    <Button
                      asChild
                      size="lg"
                      className="w-full bg-brand text-white hover:bg-brand-dark"
                    >
                      <Link href={LOGIN_HREF}>{sundayCopy.loginToRequest}</Link>
                    </Button>
                    <p className="text-sm text-slate-500">
                      <Link href={REGISTER_HREF} className="font-medium text-brand">
                        {sundayCopy.explainer.createAccount}
                      </Link>{" "}
                      {sundayCopy.loginHint}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={submitRequest} className="space-y-4">
                    <div>
                      <label htmlFor="sunday-phone" className="text-sm font-medium text-slate-700">
                        {sundayCopy.phoneLabel}
                      </label>
                      <Input
                        id="sunday-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        autoFocus
                        placeholder={sundayCopy.phonePlaceholder}
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        className="mt-1.5"
                        disabled={loading}
                      />
                    </div>
                    <SundayHistoryFields
                      answers={history}
                      onChange={(key, value) =>
                        setHistory((prev) => ({ ...prev, [key]: value }))
                      }
                      disabled={loading}
                      showErrors={showHistoryErrors}
                    />

                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium text-slate-700">
                        {sundayCopy.affordabilityTitle}
                      </legend>
                      <p className="text-xs text-slate-500">{sundayCopy.affordabilityHint}</p>

                      <label
                        className={cn(
                          "flex cursor-pointer gap-3 rounded-xl border p-3 transition",
                          affordabilityChoice === SundayAffordabilityChoices.CANNOT_AFFORD
                            ? "border-brand bg-brand-muted/40 ring-2 ring-brand/20"
                            : "border-slate-200 hover:border-slate-300",
                        )}
                      >
                        <input
                          type="radio"
                          name="sunday-affordability"
                          className="mt-1"
                          checked={
                            affordabilityChoice === SundayAffordabilityChoices.CANNOT_AFFORD
                          }
                          onChange={() =>
                            setAffordabilityChoice(SundayAffordabilityChoices.CANNOT_AFFORD)
                          }
                          disabled={loading}
                        />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">
                            {sundayCopy.affordabilityCannotAfford}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {sundayCopy.affordabilityCannotAffordHint}
                          </span>
                        </span>
                      </label>

                      <label
                        className={cn(
                          "flex cursor-pointer gap-3 rounded-xl border p-3 transition",
                          affordabilityChoice === SundayAffordabilityChoices.PAY_FEE
                            ? "border-brand bg-brand-muted/40 ring-2 ring-brand/20"
                            : "border-slate-200 hover:border-slate-300",
                        )}
                      >
                        <input
                          type="radio"
                          name="sunday-affordability"
                          className="mt-1"
                          checked={affordabilityChoice === SundayAffordabilityChoices.PAY_FEE}
                          onChange={() =>
                            setAffordabilityChoice(SundayAffordabilityChoices.PAY_FEE)
                          }
                          disabled={loading}
                        />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">
                            {sundayCopy.affordabilityPayFee.replace("{amount}", String(fee))}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {sundayCopy.affordabilityPayFeeHint.replace(
                              "{amount}",
                              String(fee),
                            )}
                          </span>
                        </span>
                      </label>
                    </fieldset>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <Button
                      type="submit"
                      variant="default"
                      className="w-full bg-brand text-white hover:bg-brand-dark"
                      disabled={loading}
                    >
                      {loading
                        ? sundayCopy.requesting
                        : affordabilityChoice === SundayAffordabilityChoices.PAY_FEE
                          ? sundayCopy.affordabilityPayFee.replace("{amount}", String(fee))
                          : sundayCopy.requestCta}
                    </Button>
                    <p className="flex items-start gap-2 text-xs text-slate-500">
                      <Video className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                      {sundayCopy.noDoctorPickHint}
                    </p>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </PageSection>

      <PageSection id="how-it-works" spacing="default">
        <SundayExplainer showCta={false} />
      </PageSection>
    </>
  );
}
