"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  HOME_CARE_MVP_SERVICES,
  HOME_CARE_PRICING,
  HomeVisitServiceTypes,
  nearestCity,
} from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/input";
import { GeoLocationPicker } from "@/components/forms/geo-location-picker";
import { useTranslations } from "@/i18n/locale-provider";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";
import { surfaceCard } from "@/lib/ui/surfaces";
import {
  PhysiotherapistPicker,
  type PhysiotherapistChoice,
} from "./physiotherapist-picker";
import { Syringe, Droplets, Bandage, Stethoscope, UserRound, Activity } from "lucide-react";

const SERVICE_META: Record<
  string,
  {
    icon: typeof Syringe;
    labelKey: "doctorVisit" | "generalNurse" | "physiotherapy" | "ivDrip" | "injection" | "woundCare";
  }
> = {
  [HomeVisitServiceTypes.DOCTOR_VISIT]: { icon: Stethoscope, labelKey: "doctorVisit" },
  [HomeVisitServiceTypes.NURSE]: { icon: UserRound, labelKey: "generalNurse" },
  [HomeVisitServiceTypes.PHYSIOTHERAPY]: { icon: Activity, labelKey: "physiotherapy" },
  [HomeVisitServiceTypes.IV_DRIP]: { icon: Droplets, labelKey: "ivDrip" },
  [HomeVisitServiceTypes.INJECTION]: { icon: Syringe, labelKey: "injection" },
  [HomeVisitServiceTypes.WOUND_CARE]: { icon: Bandage, labelKey: "woundCare" },
};

function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function minScheduledAt(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60, 0, 0);
  return toDateTimeLocalValue(d);
}

function resolveInitialService(param: string | null): string {
  if (
    param &&
    (HOME_CARE_MVP_SERVICES as readonly string[]).includes(param)
  ) {
    return param;
  }
  return HomeVisitServiceTypes.IV_DRIP;
}

function buildLoginUrl(searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  const returnPath = query
    ? `/home-care/request?${query}`
    : "/home-care/request";
  return `/login?callbackUrl=${encodeURIComponent(returnPath)}`;
}

export function HomeCareRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const t = useTranslations();
  const h = t.homeCare;
  const loginUrl = useMemo(() => buildLoginUrl(searchParams), [searchParams]);
  // Computed client-side only, after mount — "now" differs between server render and
  // hydration, which would otherwise mismatch the input's `min` attribute.
  const [minSchedule, setMinSchedule] = useState("");
  useEffect(() => {
    setMinSchedule(minScheduledAt());
  }, []);

  const [serviceType, setServiceType] = useState<string>(() =>
    resolveInitialService(searchParams.get("service")),
  );
  const [addressLine, setAddressLine] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [patientNotes, setPatientNotes] = useState("");
  const [geo, setGeo] = useState<GeoCoordinates | null>(null);
  const initialPhysioId = searchParams.get("physio");
  const [physioChoice, setPhysioChoice] = useState<PhysiotherapistChoice>(
    () => initialPhysioId || "nearest",
  );
  const isPhysio = serviceType === HomeVisitServiceTypes.PHYSIOTHERAPY;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const [physioFee, setPhysioFee] = useState<number | null>(null);

  const price =
    (isPhysio ? physioFee : null) ??
    HOME_CARE_PRICING[serviceType as keyof typeof HOME_CARE_PRICING] ??
    2000;
  const isAuthenticated = status === "authenticated";
  const isLoadingSession = status === "loading";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (isLoadingSession) return;

    if (!isAuthenticated) {
      window.location.href = loginUrl;
      return;
    }

    const trimmedAddress = addressLine.trim();
    if (trimmedAddress.length < 5) {
      setError(h.addressRequired);
      return;
    }

    if (!geo) {
      setError(h.locationRequired);
      return;
    }

    if (!scheduledAt.trim()) {
      setError(h.scheduledRequired);
      return;
    }

    const scheduled = new Date(scheduledAt);
    if (Number.isNaN(scheduled.getTime()) || scheduled <= new Date()) {
      setError(h.scheduledInPast);
      return;
    }

    setPending(true);

    try {
      const res = await fetch("/api/v1/home-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          addressLine: trimmedAddress,
          scheduledAt: scheduled.toISOString(),
          city: nearestCity(geo.lng, geo.lat),
          geo,
          patientNotes: patientNotes.trim() || undefined,
          autoAssign: isPhysio && physioChoice === "nearest",
          preferredStaffId:
            isPhysio && physioChoice !== "nearest" ? physioChoice : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? h.requestError);
      }
      router.push(`/home-care/pay?visitId=${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : h.requestError);
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className={surfaceCard}>
      <CardHeader>
        <CardTitle className="text-lg">{h.requestTitle}</CardTitle>
        <p className="text-sm text-slate-600">{h.requestDesc}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6" noValidate>
          <div>
            <Label>{h.serviceType}</Label>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {HOME_CARE_MVP_SERVICES.map((type) => {
                const meta = SERVICE_META[type];
                const Icon = meta.icon;
                const label = h.services[meta.labelKey];
                const selected = serviceType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setServiceType(type)}
                    className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-brand bg-brand-muted/50 ring-2 ring-brand/20"
                        : "border-white/60 bg-white/80 hover:border-brand/30"
                    }`}
                  >
                    <Icon className="h-5 w-5 text-brand" />
                    <span className="mt-2 text-sm font-semibold">{label}</span>
                    <span className="mt-1 text-xs text-slate-500">
                      Rs. {HOME_CARE_PRICING[type].toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="address">{h.address}</Label>
            <Input
              id="address"
              name="address"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder={h.addressPlaceholder}
              required
              minLength={5}
              className="mt-1.5"
            />
          </div>

          <GeoLocationPicker
            id="patient-home-location"
            value={geo}
            onChange={setGeo}
            required
            description={`Tap "Use my current location", or paste a Google Maps link / coordinates of your home. We match the nearest available provider to this location.`}
          />

          {isPhysio && (
            <PhysiotherapistPicker
              geo={geo}
              value={physioChoice}
              onChange={setPhysioChoice}
              initialPhysioId={initialPhysioId}
              onFeeChange={setPhysioFee}
            />
          )}

          <div>
            <Label htmlFor="scheduled">{h.scheduledAt} *</Label>
            <Input
              id="scheduled"
              name="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              min={minSchedule}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="notes">{h.notes}</Label>
            <textarea
              id="notes"
              value={patientNotes}
              onChange={(e) => setPatientNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={h.notesPlaceholder}
              className="mt-1.5 flex w-full rounded-xl border border-white/60 bg-white/90 px-3.5 py-2 text-sm shadow-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25"
            />
          </div>

          <div className="rounded-xl border border-brand/20 bg-brand-muted/40 p-4">
            <p className="text-sm text-slate-600">{h.estimatedTotal}</p>
            <p className="mt-1 text-2xl font-semibold text-brand-dark">
              Rs. {price.toLocaleString()}
            </p>
          </div>

          {error && <FieldError message={error} />}

          {!isAuthenticated && !isLoadingSession ? (
            <Button className="w-full" asChild>
              <Link href={loginUrl}>{h.signInToContinue}</Link>
            </Button>
          ) : (
            <Button
              type="submit"
              className="w-full"
              disabled={pending || isLoadingSession}
              loading={pending || isLoadingSession}
            >
              {isLoadingSession
                ? h.checkingSession
                : pending
                  ? h.submitting
                  : h.submit}
            </Button>
          )}

          {!isAuthenticated && !isLoadingSession && (
            <p className="text-center text-xs text-slate-500">{h.loginHint}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
