"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, Landmark, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, FieldError } from "@/components/ui/input";
import { surfaceCard, surfaceInset } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { cn } from "@zindagi/shared";
import type { PatientAppointmentHistoryItem } from "@/server/services/patient-appointments.service";

type Method = "bank" | "jazzcash" | "easypaisa";

const METHODS: { value: Method; label: string; icon: typeof Landmark; hint: string }[] = [
  { value: "jazzcash", label: "JazzCash", icon: Smartphone, hint: "Refund to your JazzCash mobile wallet" },
  { value: "easypaisa", label: "Easypaisa", icon: Banknote, hint: "Refund to your Easypaisa mobile wallet" },
  { value: "bank", label: "Bank transfer", icon: Landmark, hint: "Refund to your bank account" },
];

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  pending: { label: "Refund request pending review", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  approved: { label: "Refund approved — cancelled & refunded", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  denied: { label: "Refund request was denied", tone: "border-red-200 bg-red-50 text-red-800" },
};

export function RefundRequestForm({
  appointments,
  initialAppointmentId,
}: {
  appointments: PatientAppointmentHistoryItem[];
  initialAppointmentId?: string;
}) {
  const router = useRouter();
  const selectable = useMemo(
    () => appointments.filter((a) => a.canRequestCancellation),
    [appointments],
  );
  const alreadyResolved = useMemo(
    () => appointments.filter((a) => !a.canRequestCancellation),
    [appointments],
  );

  const [appointmentId, setAppointmentId] = useState(
    initialAppointmentId && selectable.some((a) => a.appointmentId === initialAppointmentId)
      ? initialAppointmentId
      : (selectable[0]?.appointmentId ?? ""),
  );
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<Method>("jazzcash");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (success) {
    return (
      <Card className={cn(surfaceCard, "text-center")}>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" aria-hidden />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Refund request submitted
          </h2>
          <p className="max-w-sm text-sm text-slate-600">
            We&apos;ve cancelled your appointment and sent your refund request to our team. Your
            money will be transferred to the account you provided within 3–5 business days.
          </p>
          <Button className="mt-2" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (selectable.length === 0) {
    return (
      <Card className={surfaceCard}>
        <CardContent className="space-y-4 py-10 text-center">
          <p className="text-sm text-slate-600">
            You don&apos;t have any upcoming appointments eligible for a refund right now.
          </p>
          {alreadyResolved.length > 0 ? (
            <div className="mx-auto max-w-md space-y-2 text-left">
              {alreadyResolved.map((a) => (
                <StatusRow key={a.appointmentId} item={a} />
              ))}
            </div>
          ) : null}
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canSubmit =
    Boolean(appointmentId) &&
    reason.trim().length >= 3 &&
    accountTitle.trim().length >= 2 &&
    accountNumber.trim().length >= 5 &&
    (method !== "bank" || bankName.trim().length >= 2);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/v1/patient/appointments/${appointmentId}/cancel-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: reason.trim(),
        refundMethod: method,
        refundAccountTitle: accountTitle.trim(),
        refundAccountNumber: accountNumber.trim(),
        ...(method === "bank" ? { refundBankName: bankName.trim() } : {}),
      }),
    });
    const json = await res.json();

    if (json.success) {
      setSuccess(true);
    } else {
      setError(json.error?.message ?? "Couldn't submit your request. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {alreadyResolved.length > 0 ? (
        <div className="space-y-2">
          {alreadyResolved.map((a) => (
            <StatusRow key={a.appointmentId} item={a} />
          ))}
        </div>
      ) : null}

      <Card className={surfaceCard}>
        <CardContent className="space-y-6 py-6">
          <div>
            <Label htmlFor="refund-appointment">Which appointment?</Label>
            <div className="mt-1.5 space-y-2">
              {selectable.map((a) => (
                <label
                  key={a.appointmentId}
                  className={cn(
                    surfaceInset,
                    "flex cursor-pointer items-center justify-between gap-3 p-3 transition-colors",
                    a.appointmentId === appointmentId && "ring-2 ring-brand-light/60",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{a.doctor.name}</p>
                    <p className="text-xs text-slate-500">
                      {a.typeLabel} · {formatKarachiDateTime(a.scheduledStart)}
                      {a.consultationFee ? ` · Rs. ${a.consultationFee.toLocaleString()}` : ""}
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="refund-appointment"
                    value={a.appointmentId}
                    checked={a.appointmentId === appointmentId}
                    onChange={() => setAppointmentId(a.appointmentId)}
                    className="h-4 w-4 shrink-0 accent-brand"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="refund-reason">Why are you cancelling?</Label>
            <textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. I no longer need this consultation, doctor was unavailable, booked by mistake…"
              maxLength={500}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-brand/20 transition focus:border-brand-light focus:ring-2"
            />
          </div>

          <div>
            <Label>How should we send your refund?</Label>
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {METHODS.map(({ value, label, icon: Icon, hint }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors",
                    method === value
                      ? "border-brand-light bg-brand-muted/60 ring-1 ring-brand-light/60"
                      : "border-slate-200 bg-white hover:border-brand-light/50",
                  )}
                >
                  <Icon
                    className={cn("h-5 w-5", method === value ? "text-brand-dark" : "text-slate-400")}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold text-slate-900">{label}</span>
                  <span className="text-xs leading-snug text-slate-500">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="refund-account-title">Account holder name</Label>
              <Input
                id="refund-account-title"
                value={accountTitle}
                onChange={(e) => setAccountTitle(e.target.value)}
                placeholder="As it appears on the account"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="refund-account-number">
                {method === "bank" ? "Account number / IBAN" : "Mobile number"}
              </Label>
              <Input
                id="refund-account-number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={method === "bank" ? "PKxx BANK 0000 1234 5678" : "03xx xxxxxxx"}
                maxLength={50}
              />
            </div>
            {method === "bank" ? (
              <div className="sm:col-span-2">
                <Label htmlFor="refund-bank-name">Bank name</Label>
                <Input
                  id="refund-bank-name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HBL, Meezan Bank"
                  maxLength={100}
                />
              </div>
            ) : null}
          </div>

          <FieldError message={error ?? undefined} />

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <Button onClick={submit} disabled={!canSubmit || submitting} loading={submitting}>
              {submitting ? "Submitting…" : "Submit refund request"}
            </Button>
            <Button variant="ghost" onClick={() => router.push("/dashboard")} disabled={submitting}>
              Cancel
            </Button>
            <p className="w-full text-xs text-slate-400 sm:w-auto sm:ml-auto">
              We&apos;ll review your request and send the money manually — no gateway fees.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusRow({ item }: { item: PatientAppointmentHistoryItem }) {
  const status = STATUS_COPY[item.cancellationRequestStatus];
  if (!status) return null;
  return (
    <div className={cn("rounded-xl border px-3.5 py-2.5 text-sm", status.tone)}>
      <p className="font-medium">
        {item.doctor.name} · {formatKarachiDateTime(item.scheduledStart)}
      </p>
      <p className="mt-0.5 text-xs opacity-90">{status.label}</p>
    </div>
  );
}
